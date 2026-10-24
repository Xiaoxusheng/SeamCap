// Package config 从环境变量（开发期加载 .env）加载全部配置。
package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
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
	// SecretFile 存放服务端随机密钥（CSRF 派生等），随 DB 数据目录持久化
	SecretFile string

	SessionTTLHours int

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

	SessionTTL time.Duration
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

// Load 读取配置。开发期若存在 .env 则加载（已存在的环境变量优先）。
func Load() (*Config, error) {
	_ = godotenv.Load() // .env 不存在不报错（生产用 systemd Environment）

	c := &Config{
		AppEnv:   get("APP_ENV", "development"),
		Port:     get("PORT", "8080"),
		BaseURL:  get("BASE_URL", "http://localhost:8080"),
		LogLevel: get("LOG_LEVEL", "info"),

		DBPath:    get("DB_PATH", "./data/seamcap.db"),
		UploadDir: get("UPLOAD_DIR", "./uploads"),
		BackupDir: get("BACKUP_DIR", "./data/backups"),

		SessionTTLHours: getInt("SESSION_TTL_HOURS", 168),

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
	}

	if c.SessionTTLHours <= 0 {
		c.SessionTTLHours = 168
	}
	c.SessionTTL = time.Duration(c.SessionTTLHours) * time.Hour

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
