// SeamCap 后端服务入口：加载配置 → 初始化日志/DB → 路由 → 启动（优雅关闭）。
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"

	"seamcap/internal/config"
	"seamcap/internal/email"
	"seamcap/internal/handler/admin"
	"seamcap/internal/handler/public"
	"seamcap/internal/logger"
	mw "seamcap/internal/middleware"
	"seamcap/internal/repository"
	"seamcap/internal/service"
	"seamcap/internal/storage"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("load config failed", "error", err.Error())
		os.Exit(1)
	}
	log := logger.New(cfg.LogLevel)
	slog.SetDefault(log)

	// 数据库（WAL + busy_timeout + 迁移）
	db, err := repository.Open(cfg.DBPath, "migrations")
	if err != nil {
		log.Error("open database failed", "error", err.Error())
		os.Exit(1)
	}
	defer db.Close()

	// 服务端密钥（CSRF 派生）
	secret, err := service.LoadOrCreateSecret(cfg.SecretFile)
	if err != nil {
		log.Error("load server secret failed", "error", err.Error())
		os.Exit(1)
	}

	// 本地文件存储
	store, err := storage.NewLocalStorage(cfg.UploadDir)
	if err != nil {
		log.Error("init storage failed", "error", err.Error())
		os.Exit(1)
	}

	// 仓库层
	auditRepo := repository.NewAuditRepo(db)
	adminRepo := repository.NewAdminRepo(db)
	mediaRepo := repository.NewMediaRepo(db)
	catRepo := repository.NewCategoryRepo(db, mediaRepo)
	prodRepo := repository.NewProductRepo(db, mediaRepo)
	craftRepo := repository.NewCraftRepo(db, mediaRepo)
	pageRepo := repository.NewPageRepo(db)
	homeRepo := repository.NewHomeRepo(db)
	settingsRepo := repository.NewSettingsRepo(db)
	inqRepo := repository.NewInquiryRepo(db)

	// 邮件
	mailSender := email.NewSender(email.Config{
		Host: cfg.SMTPHost, Port: cfg.SMTPPort, User: cfg.SMTPUser, Pass: cfg.SMTPPass,
		FromName: cfg.SMTPFromName, NotifyTo: cfg.NotifyEmail, TLSMode: cfg.SMTPTLS,
	})

	// 服务层
	authSvc := service.NewAuthService(cfg, adminRepo, auditRepo, secret)
	prodSvc := service.NewProductService(prodRepo, catRepo, mediaRepo)
	catSvc := service.NewCategoryService(catRepo, prodRepo, mediaRepo)
	mediaSvc := service.NewMediaService(mediaRepo, store, cfg.MaxImageMB, cfg.MaxVideoMB)
	craftSvc := service.NewCraftService(craftRepo, mediaRepo)
	pageSvc := service.NewPageService(pageRepo)
	homeSvc := service.NewHomeService(homeRepo, mediaRepo, prodRepo, craftRepo)
	settingsSvc := service.NewSettingsService(settingsRepo)
	inqSvc := service.NewInquiryService(inqRepo, prodRepo, mailSender, cfg.RateLimitInquiryPerHour)
	dashSvc := service.NewDashboardService(prodRepo, craftRepo, inqRepo)

	// 初始化：初始管理员 / 种子页面 / 默认设置（幂等，不覆盖已有数据）
	if created, err := service.EnsureInitialAdmin(cfg, adminRepo); err != nil {
		log.Error("ensure initial admin failed", "error", err.Error())
	} else if created {
		log.Warn("initial admin created from INITIAL_ADMIN_PASSWORD; change the password immediately after first login")
	}
	if err := pageSvc.EnsureDefaults(); err != nil {
		log.Warn("seed pages failed", "error", err.Error())
	}
	if err := settingsSvc.EnsureDefaults(); err != nil {
		log.Warn("seed settings failed", "error", err.Error())
	}

	// Handler
	pubH := &public.Public{
		Settings: settingsSvc, Home: homeSvc, Products: prodSvc, Cats: catSvc,
		Crafts: craftSvc, Pages: pageSvc, Inqs: inqSvc,
		DB: db, BaseURL: cfg.BaseURL, Started: time.Now(), Logger: log,
	}
	admH := &admin.Admin{
		Auth: authSvc, Prods: prodSvc, Cats: catSvc, Media: mediaSvc, Crafts: craftSvc,
		Pages: pageSvc, Home: homeSvc, Settings: settingsSvc, Inqs: inqSvc,
		Dash: dashSvc, Audit: auditRepo, Mail: mailSender,
		Cfg: cfg, DB: db, Logger: log,
	}

	r := chi.NewRouter()
	r.Use(mw.RequestLogger(log))
	r.Use(mw.Recoverer(log))
	r.Use(mw.SecureHeaders)

	r.Mount("/api/v1", pubH.Routes())
	r.Mount("/api/v1/admin", admH.Routes())
	r.Get("/sitemap.xml", pubH.Sitemap)
	r.Get("/robots.txt", pubH.Robots)

	// uploads 静态服务（生产建议由 Caddy/Nginx 直接服务并长缓存）
	uploadsHandler := staticDirHandler(cfg.UploadDir, "/uploads/", "public, max-age=31536000, immutable")
	if uploadsHandler != nil {
		r.Handle("/uploads/*", uploadsHandler)
	}
	if staticHandler := staticDirHandler("web/static", "/static/", "public, max-age=3600"); staticHandler != nil {
		r.Handle("/static/*", staticHandler)
	}

	// 管理后台 SPA（web/admin，Vite 构建产物）：静态命中直接服务，其余路径 fallback 到 index.html
	if adminSPA := adminSPAHandler("web/admin"); adminSPA != nil {
		r.Get("/admin", func(w http.ResponseWriter, req *http.Request) {
			http.Redirect(w, req, "/admin/", http.StatusPermanentRedirect)
		})
		r.Handle("/admin", adminSPA)
		r.Handle("/admin/", adminSPA)
		r.Handle("/admin/*", adminSPA)
	}

	// 前台 SSR 页面属前端阶段；当前返回服务状态页
	r.Get("/", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte("<!doctype html><html><head><meta charset='utf-8'><title>SeamCap</title></head>" +
			"<body><h1>SeamCap backend is running</h1>" +
			"<p>API: <a href='/api/v1/health'>/api/v1/health</a> · <a href='/api/v1/site'>/api/v1/site</a></p>" +
			"<p>Admin API: /api/v1/admin/* (session required)</p></body></html>"))
	})
	r.NotFound(func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"error":{"code":"NOT_FOUND","message":"Resource not found"}}`))
	})

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       60 * time.Second,
		WriteTimeout:      300 * time.Second, // 大视频上传需要较长写超时
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		log.Info("server started",
			"addr", srv.Addr, "env", cfg.AppEnv, "base_url", cfg.BaseURL)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("server failed", "error", err.Error())
			os.Exit(1)
		}
	}()

	// 优雅关闭
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
	log.Info("shutting down")
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Error("graceful shutdown failed", "error", err.Error())
	}
}

// adminSPAHandler 管理后台 SPA：静态文件命中直接服务；未命中 fallback 到 index.html。
// 管理页 HTML 响应附加 noindex / DENY（与 AdminSecurityHeaders 语义一致）。
func adminSPAHandler(dir string) http.HandlerFunc {
	if st, err := os.Stat(dir); err != nil || !st.IsDir() {
		return nil
	}
	return func(w http.ResponseWriter, r *http.Request) {
		rel := strings.TrimPrefix(r.URL.Path, "/admin")
		rel = strings.TrimPrefix(rel, "/")
		rel = strings.TrimSuffix(rel, "/")
		if rel == "" || rel == "index.html" {
			// 入口 HTML：不缓存（保证发版即生效）
			w.Header().Set("X-Robots-Tag", "noindex")
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("Cache-Control", "no-cache")
			http.ServeFile(w, r, filepath.Join(dir, "index.html"))
			return
		}
		if strings.Contains(rel, "..") {
			http.NotFound(w, r)
			return
		}
		abs := filepath.Join(dir, filepath.FromSlash(rel))
		if st, err := os.Stat(abs); err == nil && !st.IsDir() {
			if strings.HasPrefix(rel, "assets/") {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable") // 指纹文件名长缓存
			} else {
				w.Header().Set("Cache-Control", "no-cache")
			}
			http.ServeFile(w, r, abs)
			return
		}
		// SPA fallback：客户端路由刷新不 404
		w.Header().Set("X-Robots-Tag", "noindex")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Cache-Control", "no-cache")
		http.ServeFile(w, r, filepath.Join(dir, "index.html"))
	}
}

// staticDirHandler 静态目录服务（禁止目录列表 + 缓存头）；目录不存在返回 nil。
func staticDirHandler(dir, prefix, cacheControl string) http.HandlerFunc {
	if st, err := os.Stat(dir); err != nil || !st.IsDir() {
		return nil
	}
	fs := http.FileServer(http.Dir(dir))
	return func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(r.URL.Path, prefix)
		if name == "" || strings.HasSuffix(name, "/") || strings.Contains(name, "..") {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Cache-Control", cacheControl)
		http.StripPrefix(prefix, fs).ServeHTTP(w, r)
	}
}
