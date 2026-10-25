// Package public 公开 API 与 SEO 端点。
package public

import (
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"seamcap/internal/apperr"
	"seamcap/internal/handler"
	mw "seamcap/internal/middleware"
	"seamcap/internal/model"
	"seamcap/internal/repository"
	"seamcap/internal/seo"
	"seamcap/internal/service"
)

// Public 公开端点集合。
type Public struct {
	Settings *service.SettingsService
	Home     *service.HomeService
	Products *service.ProductService
	Cats     *service.CategoryService
	Crafts   *service.CraftService
	Packing  *service.PackingService
	Pages    *service.PageService
	Inqs     *service.InquiryService

	DB      *repository.DB
	BaseURL string
	Started time.Time
	Logger  *slog.Logger
}

// Routes 组装公开 API 路由（/api/v1 前缀）。
func (h *Public) Routes() chi.Router {
	r := chi.NewRouter()
	r.Use(mw.MaxBody(1 << 20)) // 公开 API 请求体 1MB

	r.Get("/health", h.Health)
	r.Get("/site", h.Site)
	r.Get("/home", h.GetHome)
	r.Get("/products", h.ListProducts)
	r.Get("/products/{slug}", h.GetProduct)
	r.Get("/categories", h.ListCategories)
	r.Get("/craftsmanship", h.ListCrafts)
	r.Get("/craftsmanship/{slug}", h.GetCraft)
	r.Get("/packing", h.ListPacking)
	r.Get("/pages/{slug}", h.GetPage)
	r.Post("/inquiries", h.SubmitInquiry)
	return r
}

// Health GET /api/v1/health；数据库不可用时返回 503。
func (h *Public) Health(w http.ResponseWriter, r *http.Request) {
	dbStatus := "ok"
	statusText := "ok"
	status := http.StatusOK
	if err := h.DB.Ping(); err != nil {
		dbStatus = "error"
		statusText = "degraded"
		status = http.StatusServiceUnavailable
	}
	handler.JSON(w, status, map[string]any{
		"status": statusText,
		"uptime": time.Since(h.Started).Round(time.Second).String(),
		"db":     dbStatus,
	})
}

// Site GET /api/v1/site。
func (h *Public) Site(w http.ResponseWriter, r *http.Request) {
	site, err := h.Settings.Public()
	if err != nil {
		handler.Error(w, err)
		return
	}
	handler.Data(w, site)
}

// GetHome GET /api/v1/home。
func (h *Public) GetHome(w http.ResponseWriter, r *http.Request) {
	home, err := h.Home.GetPublic()
	if err != nil {
		handler.Error(w, err)
		return
	}
	handler.Data(w, home)
}

// ListProducts GET /api/v1/products?q=&category=&page=&per_page=&sort=。
func (h *Public) ListProducts(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	p := service.ProductListParams{
		Q:       q.Get("q"),
		Page:    handler.QueryInt(r, "page", 1),
		PerPage: handler.QueryInt(r, "per_page", 12),
		Sort:    q.Get("sort"),
	}
	if cat := q.Get("category"); cat != "" {
		if id, err := strconv.ParseInt(cat, 10, 64); err == nil {
			p.CategoryID = &id
		} else {
			p.CategorySlug = cat
		}
	}
	items, page, err := h.Products.ListPublic(p)
	if err != nil {
		handler.Error(w, err)
		return
	}
	handler.List(w, items, page)
}

// GetProduct GET /api/v1/products/{slug}。
func (h *Public) GetProduct(w http.ResponseWriter, r *http.Request) {
	p, err := h.Products.GetPublicBySlug(chi.URLParam(r, "slug"))
	if err != nil {
		handler.Error(w, err)
		return
	}
	handler.Data(w, p)
}

// ListCategories GET /api/v1/categories。
func (h *Public) ListCategories(w http.ResponseWriter, r *http.Request) {
	items, err := h.Cats.ListPublic()
	if err != nil {
		handler.Error(w, err)
		return
	}
	if items == nil {
		items = []model.Category{}
	}
	handler.Data(w, items)
}

// ListCrafts GET /api/v1/craftsmanship。
func (h *Public) ListCrafts(w http.ResponseWriter, r *http.Request) {
	items, err := h.Crafts.ListPublic()
	if err != nil {
		handler.Error(w, err)
		return
	}
	if items == nil {
		items = []model.Craftsmanship{}
	}
	handler.Data(w, items)
}

// GetCraft GET /api/v1/craftsmanship/{slug}。
func (h *Public) GetCraft(w http.ResponseWriter, r *http.Request) {
	c, err := h.Crafts.GetPublicBySlug(chi.URLParam(r, "slug"))
	if err != nil {
		handler.Error(w, err)
		return
	}
	handler.Data(w, c)
}

// ListPacking GET /api/v1/packing：打包发货素材（已发布，按排序）。
func (h *Public) ListPacking(w http.ResponseWriter, r *http.Request) {
	items, err := h.Packing.ListPublic()
	if err != nil {
		handler.Error(w, err)
		return
	}
	if items == nil {
		items = []model.PackingItem{}
	}
	handler.Data(w, items)
}

// GetPage GET /api/v1/pages/{slug}。
func (h *Public) GetPage(w http.ResponseWriter, r *http.Request) {
	p, err := h.Pages.GetPublic(chi.URLParam(r, "slug"))
	if err != nil {
		handler.Error(w, err)
		return
	}
	handler.Data(w, p)
}

// SubmitInquiry POST /api/v1/inquiries。
// 公开接口 CSRF 防御：Origin/Referer 同源校验 + honeypot + 频率限制。
func (h *Public) SubmitInquiry(w http.ResponseWriter, r *http.Request) {
	if !mw.SameOrigin(r) {
		handler.Error(w, apperr.Forbidden("Cross-origin submission rejected"))
		return
	}
	var in service.InquiryInput
	if err := handler.Decode(r, &in); err != nil {
		handler.Error(w, err)
		return
	}
	ip := mw.ClientIP(r)
	ua := r.UserAgent()
	q, err := h.Inqs.Submit(in, ip, ua)
	if err != nil {
		handler.Error(w, err)
		return
	}
	handler.Created(w, map[string]any{"id": q.ID, "created_at": q.CreatedAt})
}

// Sitemap GET /sitemap.xml：仅 published 产品/工艺/页面 + 固定页。
func (h *Public) Sitemap(w http.ResponseWriter, r *http.Request) {
	var entries []seo.Entry
	entries = append(entries,
		seo.Entry{Loc: "/"},
		seo.Entry{Loc: "/products"},
		seo.Entry{Loc: "/craftsmanship"},
		seo.Entry{Loc: "/packing"},
		seo.Entry{Loc: "/about-us"},
		seo.Entry{Loc: "/contact"},
	)
	prodEntries, err := h.Products.Repo().SitemapEntries()
	if err != nil {
		handler.Error(w, err)
		return
	}
	for _, e := range prodEntries {
		entries = append(entries, seo.Entry{Loc: "/products/" + e.Slug + "/", LastMod: e.LastMod})
	}
	craftEntries, err := h.Crafts.Repo().SitemapEntries()
	if err != nil {
		handler.Error(w, err)
		return
	}
	for _, e := range craftEntries {
		entries = append(entries, seo.Entry{Loc: "/craftsmanship/" + e.Slug + "/", LastMod: e.LastMod})
	}
	pages, err := h.Pages.Repo().ListPublished()
	if err != nil {
		handler.Error(w, err)
		return
	}
	for _, p := range pages {
		if p.Slug == "about-us" || p.Slug == "privacy-policy" {
			entries = append(entries, seo.Entry{Loc: "/" + p.Slug, LastMod: p.UpdatedAt})
		} else {
			entries = append(entries, seo.Entry{Loc: "/pages/" + p.Slug, LastMod: p.UpdatedAt})
		}
	}
	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	_, _ = w.Write(seo.SitemapXML(h.BaseURL, entries))
}

// Robots GET /robots.txt。
func (h *Public) Robots(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write(seo.RobotsTXT(h.BaseURL))
}
