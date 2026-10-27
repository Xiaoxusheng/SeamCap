// Package admin 管理 API：认证、仪表盘、产品/分类/媒体/工艺/页面/首页/设置/询价管理、备份。
package admin

import (
	"encoding/base64"
	"errors"
	"fmt"
	"log/slog"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"seamcap/internal/apperr"
	"seamcap/internal/captcha"
	"seamcap/internal/config"
	"seamcap/internal/email"
	"seamcap/internal/handler"
	mw "seamcap/internal/middleware"
	"seamcap/internal/model"
	"seamcap/internal/repository"
	"seamcap/internal/service"
)

// Admin 管理端点集合。
type Admin struct {
	Auth     *service.AuthService
	Prods    *service.ProductService
	Cats     *service.CategoryService
	Media    *service.MediaService
	Crafts   *service.CraftService
	Packing  *service.PackingService
	Pages    *service.PageService
	Home     *service.HomeService
	Settings *service.SettingsService
	Inqs     *service.InquiryService
	Dash     *service.DashboardService
	Audit    *repository.AuditRepo
	Mail     *email.Sender

	Captcha *captcha.Manager

	Cfg    *config.Config
	DB     *repository.DB
	Logger *slog.Logger
}

// Routes 组装管理 API 路由（挂载于 /api/v1/admin）。
func (h *Admin) Routes() chi.Router {
	r := chi.NewRouter()
	r.Use(mw.AdminSecurityHeaders)
	r.Use(mw.NoStore)
	// 请求体上限按视频上传配置放大；图片/JSON 由各 service 二次校验
	r.Use(mw.MaxBody(int64(h.Cfg.MaxVideoMB+2) << 20))

	r.Post("/login", h.Login)
	r.Get("/captcha", h.CaptchaImage)

	r.Group(func(r chi.Router) {
		r.Use(mw.AuthRequired(h.Auth))

		r.Post("/logout", h.Logout)
		r.Get("/me", h.Me)
		r.Post("/change-password", h.ChangePassword)
		r.Get("/dashboard", h.Dashboard)

		// 产品
		r.Get("/products", h.ListProducts)
		r.Post("/products", h.CreateProduct)
		r.Get("/products/{id}", h.GetProduct)
		r.Put("/products/{id}", h.UpdateProduct)
		r.Delete("/products/{id}", h.DeleteProduct)
		r.Post("/products/{id}/duplicate", h.DuplicateProduct)
		r.Put("/products/{id}/media", h.SetProductMedia)

		// 分类
		r.Get("/categories", h.ListCategories)
		r.Post("/categories", h.CreateCategory)
		r.Get("/categories/{id}", h.GetCategory)
		r.Put("/categories/{id}", h.UpdateCategory)
		r.Delete("/categories/{id}", h.DeleteCategory)

		// 媒体
		r.Get("/media", h.ListMedia)
		r.Post("/media", h.UploadMedia)
		r.Get("/media/{id}", h.GetMedia)
		r.Put("/media/{id}", h.UpdateMedia)
		r.Delete("/media/{id}", h.DeleteMedia)

		// 工艺
		r.Get("/craftsmanship", h.ListCrafts)
		r.Post("/craftsmanship", h.CreateCraft)
		r.Get("/craftsmanship/{id}", h.GetCraft)
		r.Put("/craftsmanship/{id}", h.UpdateCraft)
		r.Delete("/craftsmanship/{id}", h.DeleteCraft)
		r.Put("/craftsmanship/{id}/media", h.SetCraftMedia)

		// 打包发货素材库
		r.Get("/packing", h.ListPacking)
		r.Post("/packing", h.CreatePacking)
		r.Get("/packing/{id}", h.GetPacking)
		r.Put("/packing/{id}", h.UpdatePacking)
		r.Delete("/packing/{id}", h.DeletePacking)

		// 页面 / 首页 / 设置
		r.Get("/pages", h.ListPages)
		r.Get("/pages/{slug}", h.GetPage)
		r.Put("/pages/{slug}", h.PutPage)
		r.Get("/home", h.GetHome)
		r.Put("/home", h.PutHome)
		r.Get("/settings", h.GetSettings)
		r.Put("/settings", h.PutSettings)

		// 询价
		r.Get("/inquiries", h.ListInquiries)
		r.Get("/inquiries/export", h.ExportInquiries)
		r.Get("/inquiries/{id}", h.Inquiry)
		r.Put("/inquiries/{id}", h.UpdateInquiry)
		r.Delete("/inquiries/{id}", h.DeleteInquiry)
		r.Post("/inquiries/{id}/resend-notify", h.ResendNotify)

		// 运维
		r.Post("/backup", h.Backup)
		r.Post("/test-email", h.TestEmail)
		r.Get("/audit-logs", h.AuditLogs)
	})
	return r
}

// ---- 认证 ----

func (h *Admin) setSessionCookie(w http.ResponseWriter, token string, maxAge int) {
	http.SetCookie(w, &http.Cookie{
		Name:     mw.SessionCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   h.Cfg.SessionCookieSecure(),
		SameSite: http.SameSiteLaxMode,
		MaxAge:   maxAge,
	})
}

// Login POST /admin/login。
func (h *Admin) Login(w http.ResponseWriter, r *http.Request) {
	if !mw.SameOrigin(r) {
		handler.Error(w, apperr.Forbidden("Cross-origin login rejected"))
		return
	}
	var in struct {
		Username    string `json:"username"`
		Password    string `json:"password"`
		CaptchaID   string `json:"captcha_id"`
		CaptchaCode string `json:"captcha_code"`
		Remember    bool   `json:"remember"`
	}
	if err := handler.Decode(r, &in); err != nil {
		handler.Error(w, err)
		return
	}
	if h.Captcha == nil {
		handler.Error(w, apperr.Internal("captcha not configured"))
		return
	}
	ip := mw.ClientIP(r)
	switch err := h.Captcha.Verify(ip, in.CaptchaID, in.CaptchaCode); {
	case err == nil:
	case errors.Is(err, captcha.ErrRateLimited):
		handler.Error(w, apperr.RateLimited("Too many captcha attempts, try again later"))
		return
	default:
		handler.Error(w, apperr.InvalidField("captcha_code", "captcha is invalid or expired"))
		return
	}
	res, err := h.Auth.Login(in.Username, in.Password, ip, r.UserAgent(), in.Remember)
	if err != nil {
		handler.Error(w, err)
		return
	}
	h.setSessionCookie(w, res.Token, int(res.TTL.Seconds()))
	handler.Data(w, map[string]any{
		"admin":      res.Admin,
		"csrf_token": res.CSRFToken,
		"expires_at": res.ExpiresAt.Format(time.RFC3339),
	})
}

// CaptchaImage GET /admin/captcha：下发一次性图形验证码（data URL PNG）。
func (h *Admin) CaptchaImage(w http.ResponseWriter, r *http.Request) {
	if h.Captcha == nil {
		handler.Error(w, apperr.Internal("captcha not configured"))
		return
	}
	ch, err := h.Captcha.NewChallenge(mw.ClientIP(r))
	if err != nil {
		if errors.Is(err, captcha.ErrRateLimited) {
			handler.Error(w, apperr.RateLimited("Too many captcha requests, try again later"))
			return
		}
		handler.Error(w, apperr.Internal(err.Error()))
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	handler.Data(w, map[string]any{
		"id":         ch.ID,
		"image":      "data:image/png;base64," + base64.StdEncoding.EncodeToString(ch.PNG),
		"expires_in": ch.ExpiresIn,
	})
}

// Logout POST /admin/logout：数据库删除会话 + Cookie 失效。
func (h *Admin) Logout(w http.ResponseWriter, r *http.Request) {
	c, err := r.Cookie(mw.SessionCookieName)
	if err == nil && c.Value != "" {
		if err := h.Auth.Logout(c.Value, mw.ClientIP(r)); err != nil {
			handler.Error(w, err)
			return
		}
	}
	h.setSessionCookie(w, "", -1)
	handler.Data(w, map[string]bool{"ok": true})
}

// Me GET /admin/me。
func (h *Admin) Me(w http.ResponseWriter, r *http.Request) {
	handler.Data(w, map[string]any{
		"admin":      mw.AdminFromContext(r.Context()),
		"csrf_token": mw.CSRFFromContext(r.Context()),
	})
}

// ChangePassword POST /admin/change-password。
func (h *Admin) ChangePassword(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Current string `json:"current"`
		New     string `json:"new"`
	}
	if err := handler.Decode(r, &in); err != nil {
		handler.Error(w, err)
		return
	}
	admin := mw.AdminFromContext(r.Context())
	if err := h.Auth.ChangePassword(admin, mw.TokenFromContext(r.Context()), in.Current, in.New); err != nil {
		handler.Error(w, err)
		return
	}
	handler.Data(w, map[string]bool{"ok": true})
}

// Dashboard GET /admin/dashboard：真实统计。
func (h *Admin) Dashboard(w http.ResponseWriter, r *http.Request) {
	d, err := h.Dash.Get()
	if err != nil {
		handler.Error(w, err)
		return
	}
	handler.Data(w, d)
}

// ---- 审计辅助 ----

func (h *Admin) auditLog(r *http.Request, action, entityType, entityID, detail string) {
	admin := mw.AdminFromContext(r.Context())
	var adminID *int64
	if admin != nil {
		adminID = &admin.ID
	}
	if err := h.Audit.Insert(adminID, action, entityType, entityID, detail, mw.ClientIP(r)); err != nil {
		h.Logger.Warn("audit log failed", "action", action, "error", err.Error())
	}
}

func pathID(r *http.Request) (int64, error) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || id <= 0 {
		return 0, apperr.InvalidField("id", "must be a positive integer")
	}
	return id, nil
}

// ---- 产品 ----

// ListProducts GET /admin/products：关键词/分类/状态/分页（含草稿）。
func (h *Admin) ListProducts(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	var categoryID *int64
	if v := q.Get("category_id"); v != "" {
		if id, err := strconv.ParseInt(v, 10, 64); err == nil {
			categoryID = &id
		}
	}
	items, page, err := h.Prods.ListAdmin(q.Get("q"), categoryID, q.Get("status"),
		handler.QueryInt(r, "page", 1), handler.QueryInt(r, "per_page", 20))
	if err != nil {
		handler.Error(w, err)
		return
	}
	handler.List(w, items, page)
}

// CreateProduct POST /admin/products：slug 冲突返回 409 + 自动建议。
func (h *Admin) CreateProduct(w http.ResponseWriter, r *http.Request) {
	var in service.ProductInput
	if err := handler.Decode(r, &in); err != nil {
		handler.Error(w, err)
		return
	}
	p, err := h.Prods.Create(in)
	if err != nil {
		handler.Error(w, err)
		return
	}
	h.auditLog(r, "product.create", "product", strconv.FormatInt(p.ID, 10), p.Name)
	handler.Created(w, p)
}

// GetProduct GET /admin/products/{id}。
func (h *Admin) GetProduct(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		handler.Error(w, err)
		return
	}
	p, err := h.Prods.GetAdminByID(id)
	if err != nil {
		handler.Error(w, err)
		return
	}
	handler.Data(w, p)
}

// UpdateProduct PUT /admin/products/{id}。
func (h *Admin) UpdateProduct(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		handler.Error(w, err)
		return
	}
	var in service.ProductInput
	if err := handler.Decode(r, &in); err != nil {
		handler.Error(w, err)
		return
	}
	p, err := h.Prods.Update(id, in)
	if err != nil {
		handler.Error(w, err)
		return
	}
	h.auditLog(r, "product.update", "product", strconv.FormatInt(id, 10), p.Name)
	handler.Data(w, p)
}

// DeleteProduct DELETE /admin/products/{id}：询价快照保留。
func (h *Admin) DeleteProduct(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		handler.Error(w, err)
		return
	}
	if err := h.Prods.Delete(id); err != nil {
		handler.Error(w, err)
		return
	}
	h.auditLog(r, "product.delete", "product", strconv.FormatInt(id, 10), "")
	handler.Data(w, map[string]bool{"ok": true})
}

// DuplicateProduct POST /admin/products/{id}/duplicate。
func (h *Admin) DuplicateProduct(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		handler.Error(w, err)
		return
	}
	p, err := h.Prods.Duplicate(id)
	if err != nil {
		handler.Error(w, err)
		return
	}
	h.auditLog(r, "product.duplicate", "product", strconv.FormatInt(id, 10), "-> "+strconv.FormatInt(p.ID, 10))
	handler.Created(w, p)
}

// SetProductMedia PUT /admin/products/{id}/media：重排/增删关联图片与角色。
func (h *Admin) SetProductMedia(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		handler.Error(w, err)
		return
	}
	var in struct {
		Items []service.MediaRefInput `json:"items"`
	}
	if err := handler.Decode(r, &in); err != nil {
		handler.Error(w, err)
		return
	}
	p, err := h.Prods.SetMedia(id, in.Items)
	if err != nil {
		handler.Error(w, err)
		return
	}
	h.auditLog(r, "product.media", "product", strconv.FormatInt(id, 10), strconv.Itoa(len(in.Items))+" items")
	handler.Data(w, p)
}

// ---- 分类 ----

// ListCategories GET /admin/categories。
func (h *Admin) ListCategories(w http.ResponseWriter, r *http.Request) {
	items, err := h.Cats.ListAdmin()
	if err != nil {
		handler.Error(w, err)
		return
	}
	if items == nil {
		items = []model.Category{}
	}
	handler.Data(w, items)
}

// CreateCategory POST /admin/categories。
func (h *Admin) CreateCategory(w http.ResponseWriter, r *http.Request) {
	var in service.CategoryInput
	if err := handler.Decode(r, &in); err != nil {
		handler.Error(w, err)
		return
	}
	c, err := h.Cats.Create(in)
	if err != nil {
		handler.Error(w, err)
		return
	}
	h.auditLog(r, "category.create", "category", strconv.FormatInt(c.ID, 10), c.Name)
	handler.Created(w, c)
}

// GetCategory GET /admin/categories/{id}。
func (h *Admin) GetCategory(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		handler.Error(w, err)
		return
	}
	c, err := h.Cats.GetAdminByID(id)
	if err != nil {
		handler.Error(w, err)
		return
	}
	handler.Data(w, c)
}

// UpdateCategory PUT /admin/categories/{id}。
func (h *Admin) UpdateCategory(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		handler.Error(w, err)
		return
	}
	var in service.CategoryInput
	if err := handler.Decode(r, &in); err != nil {
		handler.Error(w, err)
		return
	}
	c, err := h.Cats.Update(id, in)
	if err != nil {
		handler.Error(w, err)
		return
	}
	h.auditLog(r, "category.update", "category", strconv.FormatInt(id, 10), c.Name)
	handler.Data(w, c)
}

// DeleteCategory DELETE /admin/categories/{id}：
// 仍有产品关联 409；?mode=reassign&to={id} 迁移后删除；?mode=archive 停用。
func (h *Admin) DeleteCategory(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		handler.Error(w, err)
		return
	}
	res, err := h.Cats.Delete(id, r.URL.Query().Get("mode"), handler.QueryInt64(r, "to", 0))
	if err != nil {
		handler.Error(w, err)
		return
	}
	h.auditLog(r, "category.delete", "category", strconv.FormatInt(id, 10), r.URL.RawQuery)
	handler.Data(w, res)
}

// ---- 媒体 ----

// ListMedia GET /admin/media。
func (h *Admin) ListMedia(w http.ResponseWriter, r *http.Request) {
	items, page, err := h.Media.List(r.URL.Query().Get("q"),
		handler.QueryInt(r, "page", 1), handler.QueryInt(r, "per_page", 24))
	if err != nil {
		handler.Error(w, err)
		return
	}
	handler.List(w, items, page)
}

const multipartMemory = 32 << 20

func parseMultipartForm(r *http.Request) error {
	if err := r.ParseMultipartForm(multipartMemory); err != nil {
		var mbe *http.MaxBytesError
		if errors.As(err, &mbe) {
			return apperr.TooLarge("Request body too large")
		}
		return apperr.InvalidField("file", "invalid multipart form")
	}
	return nil
}

func openMultipartFile(r *http.Request) (multipart.File, string, error) {
	if err := parseMultipartForm(r); err != nil {
		return nil, "", err
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		if errors.Is(err, http.ErrMissingFile) {
			return nil, "", apperr.InvalidField("file", "file is required")
		}
		return nil, "", apperr.InvalidField("file", "cannot read uploaded file")
	}
	return file, header.Filename, nil
}

// UploadMedia POST /admin/media（multipart：file, alt_text, context）。
func (h *Admin) UploadMedia(w http.ResponseWriter, r *http.Request) {
	file, filename, err := openMultipartFile(r)
	if err != nil {
		handler.Error(w, err)
		return
	}
	defer file.Close()
	alt := r.FormValue("alt_text")
	m, err := h.Media.Upload(filename, file, alt)
	if err != nil {
		handler.Error(w, err)
		return
	}
	h.auditLog(r, "media.upload", "media", strconv.FormatInt(m.ID, 10), filename)
	handler.Created(w, m)
}

// GetMedia GET /admin/media/{id}。
func (h *Admin) GetMedia(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		handler.Error(w, err)
		return
	}
	m, err := h.Media.Get(id)
	if err != nil {
		handler.Error(w, err)
		return
	}
	handler.Data(w, m)
}

// UpdateMedia PUT /admin/media/{id}：替换文件或更新 ALT。
func (h *Admin) UpdateMedia(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		handler.Error(w, err)
		return
	}
	ct := r.Header.Get("Content-Type")
	if strings.HasPrefix(ct, "multipart/form-data") {
		if err := parseMultipartForm(r); err != nil {
			handler.Error(w, err)
			return
		}
		// 可选：替换文件本体
		if file, _, ferr := r.FormFile("file"); ferr == nil {
			if _, rerr := h.Media.Replace(id, file); rerr != nil {
				file.Close()
				handler.Error(w, rerr)
				return
			}
			file.Close()
		} else if !errors.Is(ferr, http.ErrMissingFile) {
			handler.Error(w, apperr.InvalidField("file", "cannot read uploaded file"))
			return
		}
		// 可选：更新 ALT
		if r.MultipartForm != nil {
			if alts, ok := r.MultipartForm.Value["alt_text"]; ok && len(alts) > 0 {
				if _, aerr := h.Media.UpdateAlt(id, alts[0]); aerr != nil {
					handler.Error(w, aerr)
					return
				}
			}
		}
	} else {
		var in struct {
			AltText string `json:"alt_text"`
		}
		if err := handler.Decode(r, &in); err != nil {
			handler.Error(w, err)
			return
		}
		if _, aerr := h.Media.UpdateAlt(id, in.AltText); aerr != nil {
			handler.Error(w, aerr)
			return
		}
	}
	m2, err := h.Media.Get(id)
	if err != nil {
		handler.Error(w, err)
		return
	}
	h.auditLog(r, "media.update", "media", strconv.FormatInt(id, 10), "")
	handler.Data(w, m2)
}

// DeleteMedia DELETE /admin/media/{id}：引用计数>0 时 409 并列出引用来源。
func (h *Admin) DeleteMedia(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		handler.Error(w, err)
		return
	}
	if err := h.Media.Delete(id); err != nil {
		handler.Error(w, err)
		return
	}
	h.auditLog(r, "media.delete", "media", strconv.FormatInt(id, 10), "")
	handler.Data(w, map[string]bool{"ok": true})
}

// ---- 工艺 ----

// ListCrafts GET /admin/craftsmanship。
func (h *Admin) ListCrafts(w http.ResponseWriter, r *http.Request) {
	items, err := h.Crafts.ListAdmin()
	if err != nil {
		handler.Error(w, err)
		return
	}
	handler.Data(w, items)
}

// CreateCraft POST /admin/craftsmanship。
func (h *Admin) CreateCraft(w http.ResponseWriter, r *http.Request) {
	var in service.CraftInput
	if err := handler.Decode(r, &in); err != nil {
		handler.Error(w, err)
		return
	}
	c, err := h.Crafts.Create(in)
	if err != nil {
		handler.Error(w, err)
		return
	}
	h.auditLog(r, "craft.create", "craftsmanship", strconv.FormatInt(c.ID, 10), c.Title)
	handler.Created(w, c)
}

// GetCraft GET /admin/craftsmanship/{id}。
func (h *Admin) GetCraft(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		handler.Error(w, err)
		return
	}
	c, err := h.Crafts.GetAdminByID(id)
	if err != nil {
		handler.Error(w, err)
		return
	}
	handler.Data(w, c)
}

// UpdateCraft PUT /admin/craftsmanship/{id}。
func (h *Admin) UpdateCraft(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		handler.Error(w, err)
		return
	}
	var in service.CraftInput
	if err := handler.Decode(r, &in); err != nil {
		handler.Error(w, err)
		return
	}
	c, err := h.Crafts.Update(id, in)
	if err != nil {
		handler.Error(w, err)
		return
	}
	h.auditLog(r, "craft.update", "craftsmanship", strconv.FormatInt(id, 10), c.Title)
	handler.Data(w, c)
}

// DeleteCraft DELETE /admin/craftsmanship/{id}。
func (h *Admin) DeleteCraft(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		handler.Error(w, err)
		return
	}
	if err := h.Crafts.Delete(id); err != nil {
		handler.Error(w, err)
		return
	}
	h.auditLog(r, "craft.delete", "craftsmanship", strconv.FormatInt(id, 10), "")
	handler.Data(w, map[string]bool{"ok": true})
}

// SetCraftMedia PUT /admin/craftsmanship/{id}/media。
func (h *Admin) SetCraftMedia(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		handler.Error(w, err)
		return
	}
	var in struct {
		Items []service.CraftMediaRefInput `json:"items"`
	}
	if err := handler.Decode(r, &in); err != nil {
		handler.Error(w, err)
		return
	}
	c, err := h.Crafts.SetMedia(id, in.Items)
	if err != nil {
		handler.Error(w, err)
		return
	}
	h.auditLog(r, "craft.media", "craftsmanship", strconv.FormatInt(id, 10), strconv.Itoa(len(in.Items))+" items")
	handler.Data(w, c)
}

// ---- 打包发货素材库 ----

// ListPacking GET /admin/packing。
func (h *Admin) ListPacking(w http.ResponseWriter, r *http.Request) {
	items, err := h.Packing.ListAdmin()
	if err != nil {
		handler.Error(w, err)
		return
	}
	handler.Data(w, items)
}

// CreatePacking POST /admin/packing。
func (h *Admin) CreatePacking(w http.ResponseWriter, r *http.Request) {
	var in service.PackingInput
	if err := handler.Decode(r, &in); err != nil {
		handler.Error(w, err)
		return
	}
	it, err := h.Packing.Create(in)
	if err != nil {
		handler.Error(w, err)
		return
	}
	h.auditLog(r, "packing.create", "packing", strconv.FormatInt(it.ID, 10), it.Title)
	handler.Created(w, it)
}

// GetPacking GET /admin/packing/{id}。
func (h *Admin) GetPacking(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		handler.Error(w, err)
		return
	}
	it, err := h.Packing.GetAdminByID(id)
	if err != nil {
		handler.Error(w, err)
		return
	}
	handler.Data(w, it)
}

// UpdatePacking PUT /admin/packing/{id}。
func (h *Admin) UpdatePacking(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		handler.Error(w, err)
		return
	}
	var in service.PackingInput
	if err := handler.Decode(r, &in); err != nil {
		handler.Error(w, err)
		return
	}
	it, err := h.Packing.Update(id, in)
	if err != nil {
		handler.Error(w, err)
		return
	}
	h.auditLog(r, "packing.update", "packing", strconv.FormatInt(id, 10), it.Title)
	handler.Data(w, it)
}

// DeletePacking DELETE /admin/packing/{id}。
func (h *Admin) DeletePacking(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		handler.Error(w, err)
		return
	}
	if err := h.Packing.Delete(id); err != nil {
		handler.Error(w, err)
		return
	}
	h.auditLog(r, "packing.delete", "packing", strconv.FormatInt(id, 10), "")
	handler.Data(w, map[string]bool{"ok": true})
}

// ---- 页面 / 首页 / 设置 ----

// ListPages GET /admin/pages。
func (h *Admin) ListPages(w http.ResponseWriter, r *http.Request) {
	items, err := h.Pages.List()
	if err != nil {
		handler.Error(w, err)
		return
	}
	handler.Data(w, items)
}

// GetPage GET /admin/pages/{slug}。
func (h *Admin) GetPage(w http.ResponseWriter, r *http.Request) {
	p, err := h.Pages.Get(chi.URLParam(r, "slug"))
	if err != nil {
		handler.Error(w, err)
		return
	}
	handler.Data(w, p)
}

// PutPage PUT /admin/pages/{slug}。
func (h *Admin) PutPage(w http.ResponseWriter, r *http.Request) {
	var in service.PageInput
	if err := handler.Decode(r, &in); err != nil {
		handler.Error(w, err)
		return
	}
	p, err := h.Pages.Upsert(chi.URLParam(r, "slug"), in)
	if err != nil {
		handler.Error(w, err)
		return
	}
	h.auditLog(r, "page.put", "page", p.Slug, p.Title)
	handler.Data(w, p)
}

// GetHome GET /admin/home。
func (h *Admin) GetHome(w http.ResponseWriter, r *http.Request) {
	hc, err := h.Home.GetAdmin()
	if err != nil {
		handler.Error(w, err)
		return
	}
	handler.Data(w, hc)
}

// PutHome PUT /admin/home。
func (h *Admin) PutHome(w http.ResponseWriter, r *http.Request) {
	var in service.HomeInput
	if err := handler.Decode(r, &in); err != nil {
		handler.Error(w, err)
		return
	}
	hc, err := h.Home.Update(in)
	if err != nil {
		handler.Error(w, err)
		return
	}
	h.auditLog(r, "home.update", "home", "1", "")
	handler.Data(w, hc)
}

// GetSettings GET /admin/settings。
func (h *Admin) GetSettings(w http.ResponseWriter, r *http.Request) {
	kv, err := h.Settings.AdminGet()
	if err != nil {
		handler.Error(w, err)
		return
	}
	handler.Data(w, kv)
}

// PutSettings PUT /admin/settings。
func (h *Admin) PutSettings(w http.ResponseWriter, r *http.Request) {
	var in map[string]string
	if err := handler.Decode(r, &in); err != nil {
		handler.Error(w, err)
		return
	}
	kv, err := h.Settings.AdminSet(in)
	if err != nil {
		handler.Error(w, err)
		return
	}
	h.auditLog(r, "settings.update", "settings", "", fmt.Sprint(len(in), " keys"))
	handler.Data(w, kv)
}

// ---- 询价 ----

// ListInquiries GET /admin/inquiries：搜索 + 时间/状态筛选 + 分页。
func (h *Admin) ListInquiries(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	items, page, err := h.Inqs.List(q.Get("q"), q.Get("status"), q.Get("from"), q.Get("to"),
		handler.QueryInt(r, "page", 1), handler.QueryInt(r, "per_page", 20))
	if err != nil {
		handler.Error(w, err)
		return
	}
	handler.List(w, items, page)
}

// Inquiry GET /admin/inquiries/{id}：含 events 历史。
func (h *Admin) Inquiry(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		handler.Error(w, err)
		return
	}
	q, events, err := h.Inqs.Get(id)
	if err != nil {
		handler.Error(w, err)
		return
	}
	handler.Data(w, map[string]any{"inquiry": q, "events": events})
}

// UpdateInquiry PUT /admin/inquiries/{id}：改状态/内部备注（写 inquiry_events）。
func (h *Admin) UpdateInquiry(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		handler.Error(w, err)
		return
	}
	var in service.InquiryUpdateInput
	if err := handler.Decode(r, &in); err != nil {
		handler.Error(w, err)
		return
	}
	admin := mw.AdminFromContext(r.Context())
	q, err := h.Inqs.Update(id, in, admin.ID)
	if err != nil {
		handler.Error(w, err)
		return
	}
	h.auditLog(r, "inquiry.update", "inquiry", strconv.FormatInt(id, 10), "")
	handler.Data(w, q)
}

// DeleteInquiry DELETE /admin/inquiries/{id}。
func (h *Admin) DeleteInquiry(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		handler.Error(w, err)
		return
	}
	if err := h.Inqs.Delete(id); err != nil {
		handler.Error(w, err)
		return
	}
	h.auditLog(r, "inquiry.delete", "inquiry", strconv.FormatInt(id, 10), "")
	handler.Data(w, map[string]bool{"ok": true})
}

// ExportInquiries GET /admin/inquiries/export：CSV（UTF-8 BOM，Excel 友好）。
func (h *Admin) ExportInquiries(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	data, err := h.Inqs.ExportCSV(q.Get("q"), q.Get("status"), q.Get("from"), q.Get("to"))
	if err != nil {
		handler.Error(w, err)
		return
	}
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition",
		fmt.Sprintf("attachment; filename=inquiries-%s.csv", time.Now().UTC().Format("20060102")))
	_, _ = w.Write(data)
}

// ResendNotify POST /admin/inquiries/{id}/resend-notify：重发邮件通知。
func (h *Admin) ResendNotify(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		handler.Error(w, err)
		return
	}
	q, err := h.Inqs.ResendNotify(id)
	if err != nil {
		handler.Error(w, err)
		return
	}
	handler.Data(w, q)
}

// ---- 运维 ----

// Backup POST /admin/backup：VACUUM INTO 写入 data/backups/（不停机）。
func (h *Admin) Backup(w http.ResponseWriter, r *http.Request) {
	ts := time.Now().UTC().Format("20060102-150405")
	if err := os.MkdirAll(h.Cfg.BackupDir, 0o700); err != nil {
		handler.Error(w, err)
		return
	}
	_ = os.Chmod(h.Cfg.BackupDir, 0o700)
	path := filepath.Join(h.Cfg.BackupDir, fmt.Sprintf("db-%s.db", ts))
	// 路径由服务端生成（含单引号转义兜底）
	safe := strings.ReplaceAll(path, "'", "''")
	if _, err := h.DB.Exec(fmt.Sprintf("VACUUM INTO '%s'", safe)); err != nil {
		handler.Error(w, err)
		return
	}
	_ = os.Chmod(path, 0o600) // 备份含 PII，仅属主可读
	h.auditLog(r, "backup.create", "backup", "", filepath.Base(path))
	handler.Created(w, map[string]string{"file": path})
}

// TestEmail POST /admin/test-email：SMTP 配置自检。
func (h *Admin) TestEmail(w http.ResponseWriter, r *http.Request) {
	if !h.Mail.Enabled() {
		handler.Error(w, apperr.Conflict("SMTP is not configured: set SMTP_HOST and NOTIFY_EMAIL"))
		return
	}
	if err := h.Mail.SendTestMail(); err != nil {
		handler.Error(w, apperr.New(apperr.CodeInternal, "SMTP send failed: "+err.Error()))
		return
	}
	h.auditLog(r, "email.test", "email", "", "")
	handler.Data(w, map[string]bool{"ok": true})
}

// AuditLogs GET /admin/audit-logs。
func (h *Admin) AuditLogs(w http.ResponseWriter, r *http.Request) {
	limit := handler.QueryInt(r, "limit", 100)
	items, err := h.Audit.List(limit)
	if err != nil {
		handler.Error(w, err)
		return
	}
	if items == nil {
		items = make([]repository.AuditRow, 0)
	}
	handler.Data(w, items)
}
