// Package testutil 提供测试环境装配（临时 SQLite + 仓库层 + 存储，邮件禁用）。
// 注意：不 import service/handler 包，避免测试导入环。
package testutil

import (
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"seamcap/internal/config"
	"seamcap/internal/email"
	"seamcap/internal/repository"
	"seamcap/internal/secret"
	"seamcap/internal/storage"
)

// Repos 测试用仓库集合。
type Repos struct {
	Admin    *repository.AdminRepo
	Media    *repository.MediaRepo
	Cat      *repository.CategoryRepo
	Prod     *repository.ProductRepo
	Craft    *repository.CraftRepo
	Packing  *repository.PackingRepo
	Page     *repository.PageRepo
	Home     *repository.HomeRepo
	Settings *repository.SettingsRepo
	Inq      *repository.InquiryRepo
	Audit    *repository.AuditRepo
}

// Env 测试环境（cfg/db/repos/store/secret/mail）。
type Env struct {
	Cfg    *config.Config
	DB     *repository.DB
	Secret []byte
	Store  storage.Storage
	Dir    string
	Repos  Repos
	Mail   *email.Sender
}

func repoRoot() string {
	_, thisFile, _, _ := runtime.Caller(0)
	// internal/testutil/testutil.go → 仓库根
	return filepath.Dir(filepath.Dir(filepath.Dir(thisFile)))
}

// Cfg 创建指向临时目录的测试配置。
func Cfg(dir string) *config.Config {
	cfg := &config.Config{
		AppEnv:    "development",
		Port:      "0",
		BaseURL:   "http://test.local",
		LogLevel:  "error",
		DBPath:    filepath.Join(dir, "test.db"),
		UploadDir: filepath.Join(dir, "uploads"),
		BackupDir: filepath.Join(dir, "backups"),

		SecretFile: filepath.Join(dir, "secret.key"),

		SessionTTLHours:  1,
		SessionTTL:       time.Hour,
		RememberTTLHours: 720,
		RememberTTL:      720 * time.Hour,

		SMTPPort:     465,
		SMTPFromName: "SeamCap Test",
		SMTPTLS:      "none",

		RateLimitInquiryPerHour: 2,
		MaxImageMB:              1,
		MaxVideoMB:              5,
	}
	return cfg
}

// NewEnv 创建临时测试环境（每个测试独立，邮件未配置 → 通知状态 skipped）。
func NewEnv(t *testing.T) *Env {
	t.Helper()
	dir := t.TempDir()
	cfg := Cfg(dir)

	db, err := repository.Open(cfg.DBPath, filepath.Join(repoRoot(), "migrations"))
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	secret, err := secret.LoadOrCreateSecret(cfg.SecretFile)
	if err != nil {
		t.Fatalf("secret: %v", err)
	}
	store, err := storage.NewLocalStorage(cfg.UploadDir)
	if err != nil {
		t.Fatalf("storage: %v", err)
	}

	mail := email.NewSender(email.Config{TLSMode: "none"}) // 未配置 → Disabled

	return &Env{
		Cfg: cfg, DB: db, Secret: secret, Store: store, Dir: dir, Mail: mail,
		Repos: Repos{
			Admin:    repository.NewAdminRepo(db),
			Media:    repository.NewMediaRepo(db),
			Cat:      repository.NewCategoryRepo(db, repository.NewMediaRepo(db)),
			Prod:     repository.NewProductRepo(db, repository.NewMediaRepo(db)),
			Craft:    repository.NewCraftRepo(db, repository.NewMediaRepo(db)),
			Packing:  repository.NewPackingRepo(db, repository.NewMediaRepo(db)),
			Page:     repository.NewPageRepo(db),
			Home:     repository.NewHomeRepo(db),
			Settings: repository.NewSettingsRepo(db),
			Inq:      repository.NewInquiryRepo(db),
			Audit:    repository.NewAuditRepo(db),
		},
	}
}
