// Package config 从环境变量（开发期加载 .env）加载全部配置。
package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	AppEnv   string // development | production
	Port     string
	BaseURL  string
	LogLevel string

	DBPath    string
	UploadDir string
	BackupDir string
	// ImageCacheDir 图片缩放缓存目录（?w= 按需生成，见 internal/imgsrv）
	ImageCacheDir string
	// SecretFile 存放服务端随机密钥（CSRF 派生等），随 DB 数据目录持久化
	SecretFile string

	SessionTTLHours  int
	RememberTTLHours int

	InitialAdminUser     string
	InitialAdminPassword string

	SMTPHost     string
	SMTPPort     int
	SMTPUser     string
	SMTPPass     string
	SMTPFromName string
	NotifyEmail  string
	SMTPTLS      string // ssl | starttls | none

	RateLimitInquiryPerHour int
	MaxImageMB              int
	MaxVideoMB              int

	// TrustedProxies 受信反代网段（CIDR）；仅这些来源的 X-Forwarded-For 会被信任
	TrustedProxies []string

	// CookieSecureOverride 会话 Cookie 的 Secure 标记：auto(默认，跟随 APP_ENV) | true | false
	// 纯 HTTP 部署（如直接用公网 IP 访问、未接 TLS）必须设为 false，
	// 否则浏览器会丢弃 Secure Cookie，导致管理后台登录后立刻掉线。
	CookieSecureOverride string

	SessionTTL  time.Duration
	RememberTTL time.Duration
}

func get(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func getInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

// Load 读取配置。开发期若存在 .env 则加载（已存在的环境变量优先）。
func Load() (*Config, error) {
	_ = godotenv.Load() // .env 不存在不报错（生产用 systemd Environment）

	c := &Config{
		AppEnv:   get("APP_ENV", "development"),
		Port:     get("PORT", "8080"),
		BaseURL:  get("BASE_URL", "http://localhost:8080"),
		LogLevel: get("LOG_LEVEL", "info"),

		DBPath:        get("DB_PATH", "./data/seamcap.db"),
		UploadDir:     get("UPLOAD_DIR", "./uploads"),
		BackupDir:     get("BACKUP_DIR", "./data/backups"),
		ImageCacheDir: get("IMAGE_CACHE_DIR", "./data/imgcache"),

		SessionTTLHours:  getInt("SESSION_TTL_HOURS", 168),
		RememberTTLHours: getInt("REMEMBER_TTL_HOURS", 720),

		InitialAdminUser:     get("INITIAL_ADMIN_USER", "admin"),
		InitialAdminPassword: os.Getenv("INITIAL_ADMIN_PASSWORD"),

		SMTPHost:     os.Getenv("SMTP_HOST"),
		SMTPPort:     getInt("SMTP_PORT", 465),
		SMTPUser:     os.Getenv("SMTP_USER"),
		SMTPPass:     os.Getenv("SMTP_PASS"),
		SMTPFromName: get("SMTP_FROM_NAME", "SeamCap Factory"),
		NotifyEmail:  os.Getenv("NOTIFY_EMAIL"),
		SMTPTLS:      get("SMTP_TLS", "ssl"),

		RateLimitInquiryPerHour: getInt("RATE_LIMIT_INQUIRY_PER_HOUR", 10),
		MaxImageMB:              getInt("MAX_IMAGE_MB", 10),
		MaxVideoMB:              getInt("MAX_VIDEO_MB", 500),

		TrustedProxies: splitCSV(get("TRUSTED_PROXIES",
			"127.0.0.0/8,::1/128,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,fc00::/7")),

		CookieSecureOverride: strings.ToLower(get("COOKIE_SECURE", "auto")),
	}

	if c.SessionTTLHours <= 0 {
		c.SessionTTLHours = 168
	}
	if c.RememberTTLHours <= 0 {
		c.RememberTTLHours = 720
	}
	c.SessionTTL = time.Duration(c.SessionTTLHours) * time.Hour
	c.RememberTTL = time.Duration(c.RememberTTLHours) * time.Hour
	if c.RememberTTL < c.SessionTTL {
		c.RememberTTL = c.SessionTTL // 记住登录不应短于普通会话
	}

	if c.RateLimitInquiryPerHour <= 0 {
		c.RateLimitInquiryPerHour = 10
	}
	if c.MaxImageMB <= 0 {
		c.MaxImageMB = 10
	}
	if c.MaxVideoMB <= 0 {
		c.MaxVideoMB = 500
	}
	if c.SMTPTLS != "ssl" && c.SMTPTLS != "starttls" && c.SMTPTLS != "none" {
		return nil, fmt.Errorf("invalid SMTP_TLS %q: must be ssl|starttls|none", c.SMTPTLS)
	}
	if _, err := strconv.Atoi(c.Port); err != nil {
		return nil, fmt.Errorf("invalid PORT %q", c.Port)
	}

	// 服务端密钥与数据库同目录持久化
	c.SecretFile = filepath.Join(filepath.Dir(c.DBPath), "secret.key")
	return c, nil
}

func (c *Config) IsProduction() bool { return c.AppEnv == "production" }

// SessionCookieSecure 决定会话 Cookie 是否带 Secure 标记。
// 显式 COOKIE_SECURE=true/false 优先；未设置（auto）时跟随 APP_ENV。
func (c *Config) SessionCookieSecure() bool {
	switch c.CookieSecureOverride {
	case "true", "1", "yes", "on":
		return true
	case "false", "0", "no", "off":
		return false
	}
	return c.IsProduction()
}
