// Package service 业务逻辑层：校验、状态流转、权限判断、组合调用。
// 统一错误：返回 *apperr.Error，由 handler 映射为 HTTP 状态码。
package service

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"log/slog"
	"regexp"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/argon2"

	"seamcap/internal/apperr"
	"seamcap/internal/config"
	"seamcap/internal/model"
	"seamcap/internal/repository"
	"seamcap/internal/secret"
)

// AuthService 登录/会话/改密/限流。
type AuthService struct {
	cfg    *config.Config
	admins *repository.AdminRepo
	audit  *repository.AuditRepo
	secret []byte

	loginLimiter *limiter
	passLimiter  *limiter
	hashSem      chan struct{}
	dummyHash    string
}

// maxConcurrentArgon2 限制同时进行的 Argon2 运算数（单次 64MB，防并发内存放大）。
const maxConcurrentArgon2 = 8

func NewAuthService(cfg *config.Config, admins *repository.AdminRepo, audit *repository.AuditRepo, secret []byte) *AuthService {
	// 占位哈希：用户名不存在时仍执行一次完整的 Argon2 校验，避免时序侧信道。
	dummy, err := hashPassword("dummy-password-for-timing")
	if err != nil {
		panic("seed dummy argon2 hash: " + err.Error())
	}
	return &AuthService{
		cfg:          cfg,
		admins:       admins,
		audit:        audit,
		secret:       secret,
		loginLimiter: newLimiter(5, 5*time.Minute),
		passLimiter:  newLimiter(5, 5*time.Minute),
		hashSem:      make(chan struct{}, maxConcurrentArgon2),
		dummyHash:    dummy,
	}
}

// acquireHash 非阻塞获取 Argon2 槽位；拿不到说明并发登录过多。
func (s *AuthService) acquireHash() bool {
	select {
	case s.hashSem <- struct{}{}:
		return true
	default:
		return false
	}
}

func (s *AuthService) releaseHash() { <-s.hashSem }

// ---- 内存滑动窗口限流（登录用） ----

// limiterMaxKeys 单个限流表的最大 key 数；超限时按过期/最久未活动淘汰，避免整表重置。
const limiterMaxKeys = 20000

type limiter struct {
	mu     sync.Mutex
	m      map[string][]time.Time
	limit  int
	window time.Duration
}

func newLimiter(limit int, window time.Duration) *limiter {
	return &limiter{m: make(map[string][]time.Time), limit: limit, window: window}
}

// Allow 记录一次尝试；窗口内超过 limit 返回 false。
func (l *limiter) Allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	stamps := l.m[key][:0]
	for _, t := range l.m[key] {
		if now.Sub(t) < l.window {
			stamps = append(stamps, t)
		}
	}
	if len(stamps) >= l.limit {
		l.m[key] = stamps
		return false
	}
	l.m[key] = append(stamps, now)
	if len(l.m) > limiterMaxKeys {
		l.pruneLocked(now)
	}
	return true
}

// pruneLocked 先删除窗口内无活动的 key，仍超限时只淘汰最久未活动的 key，
// 避免整表清空导致所有限流同时失效。
func (l *limiter) pruneLocked(now time.Time) {
	var oldestKey string
	var oldest time.Time
	for k, ts := range l.m {
		if len(ts) == 0 || now.Sub(ts[len(ts)-1]) >= l.window {
			delete(l.m, k)
			continue
		}
		if oldestKey == "" || ts[len(ts)-1].Before(oldest) {
			oldestKey, oldest = k, ts[len(ts)-1]
		}
	}
	if len(l.m) > limiterMaxKeys && oldestKey != "" {
		delete(l.m, oldestKey)
	}
}

func (l *limiter) Reset(key string) {
	l.mu.Lock()
	delete(l.m, key)
	l.mu.Unlock()
}

// ---- Argon2id ----

// argon 参数：time=1, memory=64MB, threads=4（文档要求）。
const (
	argonTime    = 1
	argonMemory  = 64 * 1024 // KiB
	argonThreads = 4
	argonKeyLen  = 32
	argonSaltLen = 16
)

// HashPassword 导出的密码哈希（测试与引导用）。
func HashPassword(password string) (string, error) { return hashPassword(password) }

// VerifyPassword 导出的密码校验（测试用）。
func VerifyPassword(encoded, password string) bool { return verifyPassword(encoded, password) }

func hashPassword(password string) (string, error) {
	salt := make([]byte, argonSaltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	key := argon2.IDKey([]byte(password), salt, argonTime, argonMemory, argonThreads, argonKeyLen)
	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, argonMemory, argonTime, argonThreads,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(key)), nil
}

func verifyPassword(encoded, password string) bool {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[1] != "argon2id" {
		return false
	}
	var version int
	if _, err := fmt.Sscanf(parts[2], "v=%d", &version); err != nil || version != argon2.Version {
		return false
	}
	var m uint32
	var t uint32
	var p uint8
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &m, &t, &p); err != nil {
		return false
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return false
	}
	want, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return false
	}
	got := argon2.IDKey([]byte(password), salt, t, m, p, uint32(len(want)))
	return subtle.ConstantTimeCompare(got, want) == 1 // 恒定时间比较
}

// ---- Token / CSRF ----

func randomToken() (string, error) {
	b := make([]byte, 16) // 128bit
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func tokenHash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// CSRFToken 由会话明文 token 派生（服务端密钥参与），绑定会话。
func (s *AuthService) CSRFToken(token string) string {
	mac := hmac.New(sha256.New, s.secret)
	mac.Write([]byte("csrf:" + token))
	return hex.EncodeToString(mac.Sum(nil))
}

// CheckCSRF 恒定时间比较。
func (s *AuthService) CheckCSRF(token, presented string) bool {
	if presented == "" || token == "" {
		return false
	}
	want := s.CSRFToken(token)
	return subtle.ConstantTimeCompare([]byte(want), []byte(presented)) == 1
}

// ---- 登录 / 会话 ----

// LoginResult 登录成功返回。
type LoginResult struct {
	Admin     *model.AdminUser
	Token     string
	CSRFToken string
	ExpiresAt time.Time
	TTL       time.Duration
}

// Login 登录：限流（IP+账号 各 5 次/5 分钟）→ 校验 → 建会话 → 审计。
// remember=true 时会话与 Cookie 使用 RememberTTL（默认 30 天）。
func (s *AuthService) Login(username, password, ip, ua string, remember bool) (*LoginResult, error) {
	if !s.loginLimiter.Allow("ip:" + ip) {
		return nil, apperr.RateLimited("Too many login attempts from this IP, try again later")
	}
	if !s.loginLimiter.Allow("user:" + username) {
		return nil, apperr.RateLimited("Too many login attempts for this account, try again later")
	}
	if !s.acquireHash() {
		return nil, apperr.RateLimited("Too many concurrent login attempts, try again later")
	}
	defer s.releaseHash()

	admin, err := s.admins.GetAdminByUsername(username)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	if admin == nil {
		verifyPassword(s.dummyHash, password) // 恒定时间防御
		_ = s.audit.Insert(nil, "login.failed", "admin", "", "unknown username", ip)
		return nil, apperr.Unauthorized("Invalid username or password")
	}
	if !verifyPassword(admin.PasswordHash, password) {
		_ = s.audit.Insert(&admin.ID, "login.failed", "admin", fmt.Sprint(admin.ID), "invalid password", ip)
		return nil, apperr.Unauthorized("Invalid username or password")
	}

	token, err := randomToken()
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	ttl := s.cfg.SessionTTL
	if remember {
		ttl = s.cfg.RememberTTL
	}
	now := time.Now().UTC()
	expiresAt := now.Add(ttl)
	sess := &model.Session{
		TokenHash: tokenHash(token),
		AdminID:   admin.ID,
		IP:        ip,
		UserAgent: ua,
		Remember:  remember,
		ExpiresAt: expiresAt.Format(time.RFC3339),
	}
	if _, err := s.admins.CreateSession(sess); err != nil {
		return nil, apperr.Internal(err.Error())
	}
	_, _ = s.admins.DeleteExpiredSessions() // 顺带清理
	s.loginLimiter.Reset("ip:" + ip)
	s.loginLimiter.Reset("user:" + username)
	_ = s.audit.Insert(&admin.ID, "login", "admin", fmt.Sprint(admin.ID), "", ip)

	return &LoginResult{Admin: admin, Token: token, CSRFToken: s.CSRFToken(token), ExpiresAt: expiresAt, TTL: ttl}, nil
}

// Validate 校验会话 token：查 sessions 表（未过期）→ 注入 admin；滑动续期。
func (s *AuthService) Validate(token string) (*model.AdminUser, *model.Session, error) {
	if token == "" {
		return nil, nil, apperr.Unauthorized("")
	}
	sess, err := s.admins.GetSession(tokenHash(token))
	if err != nil {
		return nil, nil, apperr.Internal(err.Error())
	}
	if sess == nil {
		return nil, nil, apperr.Unauthorized("Session expired")
	}
	expiresAt, err := time.Parse(time.RFC3339, sess.ExpiresAt)
	if err != nil || time.Now().UTC().After(expiresAt) {
		_ = s.admins.DeleteSession(sess.TokenHash)
		return nil, nil, apperr.Unauthorized("Session expired")
	}
	admin, err := s.admins.GetAdminByID(sess.AdminID)
	if err != nil {
		return nil, nil, apperr.Internal(err.Error())
	}
	if admin == nil {
		return nil, nil, apperr.Unauthorized("Session expired")
	}
	// 滑动续期：剩余不足一半时延长至完整 TTL（记住登录使用 30 天 TTL）
	ttl := s.cfg.SessionTTL
	if sess.Remember {
		ttl = s.cfg.RememberTTL
	}
	if expiresAt.Sub(time.Now().UTC()) < ttl/2 {
		newExp := time.Now().UTC().Add(ttl).Format(time.RFC3339)
		if err := s.admins.ExtendSession(sess.ID, newExp); err != nil {
			slog.Warn("extend session failed", "error", err)
		}
	}
	return admin, sess, nil
}

// Logout 注销：数据库删除 + Cookie 失效由 handler 处理。
func (s *AuthService) Logout(token, ip string) error {
	if token == "" {
		return nil
	}
	sess, err := s.admins.GetSession(tokenHash(token))
	if err != nil || sess == nil {
		return err
	}
	if err := s.admins.DeleteSession(sess.TokenHash); err != nil {
		return err
	}
	_ = s.audit.Insert(&sess.AdminID, "logout", "admin", fmt.Sprint(sess.AdminID), "", ip)
	return nil
}

var pwLetter = regexp.MustCompile(`[A-Za-z]`)
var pwDigit = regexp.MustCompile(`[0-9]`)

// ChangePassword 改密：校验当前密码 + 新密码强度（≥10 位，含字母数字），保留当前会话。
func (s *AuthService) ChangePassword(admin *model.AdminUser, currentToken, current, next string) error {
	key := fmt.Sprintf("pw:%d", admin.ID)
	if !s.passLimiter.Allow(key) {
		return apperr.RateLimited("Too many password change attempts, try again later")
	}
	if !s.acquireHash() {
		return apperr.RateLimited("Too many concurrent password operations, try again later")
	}
	defer s.releaseHash()

	if !verifyPassword(admin.PasswordHash, current) {
		return apperr.InvalidField("current", "current password is incorrect")
	}
	if len(next) < 10 || !pwLetter.MatchString(next) || !pwDigit.MatchString(next) {
		return apperr.InvalidField("new", "password must be at least 10 characters and contain letters and digits")
	}
	hash, err := hashPassword(next)
	if err != nil {
		return apperr.Internal(err.Error())
	}
	if err := s.admins.UpdatePassword(admin.ID, hash); err != nil {
		return apperr.Internal(err.Error())
	}
	s.passLimiter.Reset(key)
	// 其余会话全部失效，保留当前会话
	if err := s.admins.DeleteOtherSessions(admin.ID, tokenHash(currentToken)); err != nil {
		slog.Warn("delete other sessions failed", "error", err)
	}
	_ = s.audit.Insert(&admin.ID, "admin.change_password", "admin", fmt.Sprint(admin.ID), "", "")
	return nil
}

// EnsureInitialAdmin 首次启动创建初始管理员（之后该项失效）。
func EnsureInitialAdmin(cfg *config.Config, admins *repository.AdminRepo) (bool, error) {
	n, err := admins.CountAdmins()
	if err != nil {
		return false, err
	}
	if n > 0 {
		return false, nil
	}
	if cfg.InitialAdminPassword == "" {
		slog.Warn("no admin exists and INITIAL_ADMIN_PASSWORD is empty; admin must be created manually")
		return false, nil
	}
	hash, err := hashPassword(cfg.InitialAdminPassword)
	if err != nil {
		return false, err
	}
	username := cfg.InitialAdminUser
	if username == "" {
		username = "admin"
	}
	if _, err := admins.CreateAdmin(username, hash); err != nil {
		return false, err
	}
	slog.Info("initial admin created", "username", username)
	return true, nil
}

// LoadOrCreateSecret 读取或创建服务端随机密钥（委托 internal/secret）。
func LoadOrCreateSecret(path string) ([]byte, error) {
	return secret.LoadOrCreateSecret(path)
}
