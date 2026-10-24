// Package captcha 管理后台登录图形验证码：4 位数字 + 干扰线/噪点，内存存储、单次有效。
package captcha

import (
	"bytes"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"image"
	"image/color"
	"image/png"
	"math"
	mrand "math/rand/v2"
	"strings"
	"sync"
	"time"
)

const (
	CodeLength   = 4
	DefaultTTL   = 5 * time.Minute
	canvasWidth  = 132
	canvasHeight = 44
	glyphScale   = 4
)

var (
	// ErrInvalid 验证码不存在、已过期或答案错误。
	ErrInvalid = errors.New("captcha invalid or expired")
	// ErrRateLimited 同一 IP 请求验证码/尝试验证过于频繁。
	ErrRateLimited = errors.New("captcha rate limited")
)

// Challenge 一次验证码挑战；Answer 仅供服务端校验与测试使用，不得返回给客户端。
type Challenge struct {
	ID        string
	Answer    string
	PNG       []byte
	ExpiresIn int
}

type entry struct {
	answer  string
	expires time.Time
}

// Manager 内存验证码存储与按 IP 限流。
type Manager struct {
	ttl      time.Duration
	maxItems int

	mu    sync.Mutex
	items map[string]entry

	gen    *windowLimiter
	verify *windowLimiter
}

func NewManager(ttl time.Duration) *Manager {
	if ttl <= 0 {
		ttl = DefaultTTL
	}
	return &Manager{
		ttl:      ttl,
		maxItems: 5000,
		items:    make(map[string]entry),
		gen:      newWindowLimiter(60, 5*time.Minute), // 每 IP 5 分钟最多 60 张
		verify:   newWindowLimiter(30, 5*time.Minute), // 每 IP 5 分钟最多 30 次尝试
	}
}

// NewChallenge 生成新的验证码（答案 4 位数字）并渲染 PNG。
func (m *Manager) NewChallenge(ip string) (*Challenge, error) {
	if !m.gen.Allow(ip) {
		return nil, ErrRateLimited
	}
	id, err := randomID()
	if err != nil {
		return nil, err
	}
	answer, err := randomDigits(CodeLength)
	if err != nil {
		return nil, err
	}
	img, err := render(answer)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	m.mu.Lock()
	m.purgeLocked(now)
	if len(m.items) >= m.maxItems {
		m.evictOneLocked()
	}
	m.items[id] = entry{answer: answer, expires: now.Add(m.ttl)}
	m.mu.Unlock()

	return &Challenge{ID: id, Answer: answer, PNG: img, ExpiresIn: int(m.ttl.Seconds())}, nil
}

// Verify 校验答案；无论对错都消耗该挑战（防重放与爆破）。
func (m *Manager) Verify(ip, id, code string) error {
	if !m.verify.Allow(ip) {
		return ErrRateLimited
	}
	if id == "" || code == "" {
		return ErrInvalid
	}

	now := time.Now()
	m.mu.Lock()
	it, ok := m.items[id]
	if ok {
		delete(m.items, id)
	}
	m.mu.Unlock()
	if !ok || now.After(it.expires) {
		return ErrInvalid
	}
	got := normalize(code)
	if len(got) != len(it.answer) {
		return ErrInvalid
	}
	if subtle.ConstantTimeCompare([]byte(got), []byte(it.answer)) != 1 {
		return ErrInvalid
	}
	return nil
}

func (m *Manager) purgeLocked(now time.Time) {
	for id, it := range m.items {
		if now.After(it.expires) {
			delete(m.items, id)
		}
	}
}

func (m *Manager) evictOneLocked() {
	var oldestID string
	var oldest time.Time
	for id, it := range m.items {
		if oldestID == "" || it.expires.Before(oldest) {
			oldestID, oldest = id, it.expires
		}
	}
	if oldestID != "" {
		delete(m.items, oldestID)
	}
}

func normalize(code string) string {
	return strings.ToUpper(strings.TrimSpace(code))
}

func randomID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// randomDigits 拒绝采样避免取模偏差。
func randomDigits(n int) (string, error) {
	out := make([]byte, n)
	b := make([]byte, 1)
	for i := 0; i < n; {
		if _, err := rand.Read(b); err != nil {
			return "", err
		}
		if b[0] < 250 {
			out[i] = '0' + b[0]%10
			i++
		}
	}
	return string(out), nil
}

// ---- 渲染 ----

var digitPatterns = [10][7]string{
	{"01110", "10001", "10011", "10101", "11001", "10001", "01110"},
	{"00100", "01100", "00100", "00100", "00100", "00100", "01110"},
	{"01110", "10001", "00001", "00010", "00100", "01000", "11111"},
	{"11111", "00010", "00100", "00010", "00001", "10001", "01110"},
	{"00010", "00110", "01010", "10010", "11111", "00010", "00010"},
	{"11111", "10000", "11110", "00001", "00001", "10001", "01110"},
	{"00110", "01000", "10000", "11110", "10001", "10001", "01110"},
	{"11111", "00001", "00010", "00100", "01000", "01000", "01000"},
	{"01110", "10001", "10001", "01110", "10001", "10001", "01110"},
	{"01110", "10001", "10001", "01111", "00001", "00010", "01100"},
}

var inkColors = []color.RGBA{
	{31, 58, 95, 255}, {35, 70, 118, 255}, {52, 73, 94, 255},
	{74, 52, 110, 255}, {28, 80, 80, 255}, {90, 60, 30, 255},
}

func render(answer string) ([]byte, error) {
	img := image.NewRGBA(image.Rect(0, 0, canvasWidth, canvasHeight))

	// 浅色渐变背景
	for y := 0; y < canvasHeight; y++ {
		t := float64(y) / float64(canvasHeight-1)
		c := color.RGBA{
			R: uint8(247 - 11*t), G: uint8(249 - 8*t), B: uint8(252 - 4*t), A: 255,
		}
		for x := 0; x < canvasWidth; x++ {
			img.SetRGBA(x, y, c)
		}
	}

	// 背景噪点
	for i := 0; i < 100; i++ {
		x, y := mrand.IntN(canvasWidth), mrand.IntN(canvasHeight)
		g := uint8(205 + mrand.IntN(35))
		img.Set(x, y, color.RGBA{g, g, uint8(min(int(g)+6, 255)), 255})
	}

	// 文字层：随机颜色/位置
	text := image.NewRGBA(img.Bounds())
	x := 12
	for _, c := range answer {
		d := int(c - '0')
		y := 6 + mrand.IntN(9)
		drawGlyph(text, x+mrand.IntN(4)-2, y, d, inkColors[mrand.IntN(len(inkColors))])
		x += 28
	}

	// 横向波浪扭曲（整行平移，保持可读）
	phase := mrand.Float64() * 2 * math.Pi
	for y := 0; y < canvasHeight; y++ {
		shift := int(math.Round(2 * math.Sin(float64(y)/7+phase)))
		for x := 0; x < canvasWidth; x++ {
			sx := x + shift
			if sx < 0 || sx >= canvasWidth {
				continue
			}
			c := text.RGBAAt(sx, y)
			if c.A > 0 {
				img.SetRGBA(x, y, c)
			}
		}
	}

	// 干扰线
	for i := 0; i < 2; i++ {
		y0, y1 := mrand.IntN(canvasHeight), mrand.IntN(canvasHeight)
		drawLine(img, 0, y0, canvasWidth-1, y1, color.RGBA{160, 175, 198, 255})
	}
	// 前景噪点
	for i := 0; i < 40; i++ {
		x, y := mrand.IntN(canvasWidth), mrand.IntN(canvasHeight)
		g := uint8(120 + mrand.IntN(70))
		img.Set(x, y, color.RGBA{g, g, uint8(min(int(g)+10, 255)), 255})
	}

	// 边框
	for x := 0; x < canvasWidth; x++ {
		img.Set(x, 0, color.RGBA{206, 214, 228, 255})
		img.Set(x, canvasHeight-1, color.RGBA{206, 214, 228, 255})
	}
	for y := 0; y < canvasHeight; y++ {
		img.Set(0, y, color.RGBA{206, 214, 228, 255})
		img.Set(canvasWidth-1, y, color.RGBA{206, 214, 228, 255})
	}

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func drawGlyph(dst *image.RGBA, x0, y0, digit int, c color.RGBA) {
	for row, line := range digitPatterns[digit] {
		for col, ch := range line {
			if ch != '1' {
				continue
			}
			for dy := 0; dy < glyphScale; dy++ {
				for dx := 0; dx < glyphScale; dx++ {
					dst.Set(x0+col*glyphScale+dx, y0+row*glyphScale+dy, c)
				}
			}
		}
	}
}

func drawLine(img *image.RGBA, x0, y0, x1, y1 int, c color.RGBA) {
	dx := int(math.Abs(float64(x1 - x0)))
	dy := int(math.Abs(float64(y1 - y0)))
	sx, sy := 1, 1
	if x0 > x1 {
		sx = -1
	}
	if y0 > y1 {
		sy = -1
	}
	err := dx - dy
	for {
		img.Set(x0, y0, c)
		if x0 == x1 && y0 == y1 {
			return
		}
		e2 := 2 * err
		if e2 > -dy {
			err -= dy
			x0 += sx
		}
		if e2 < dx {
			err += dx
			y0 += sy
		}
	}
}

// ---- 简单滑动窗口限流 ----

type windowLimiter struct {
	mu     sync.Mutex
	m      map[string][]time.Time
	limit  int
	window time.Duration
}

func newWindowLimiter(limit int, window time.Duration) *windowLimiter {
	return &windowLimiter{m: make(map[string][]time.Time), limit: limit, window: window}
}

func (l *windowLimiter) Allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	kept := l.m[key][:0]
	for _, t := range l.m[key] {
		if now.Sub(t) < l.window {
			kept = append(kept, t)
		}
	}
	if len(kept) >= l.limit {
		l.m[key] = kept
		return false
	}
	l.m[key] = append(kept, now)
	if len(l.m) > 10000 {
		l.m = map[string][]time.Time{key: {now}}
	}
	return true
}
