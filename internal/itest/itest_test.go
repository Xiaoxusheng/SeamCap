// Package itest 通过 httptest 走完整 HTTP 栈的接口测试：
// 公开接口仅返回 published；未登录访问管理接口 401；slug 冲突 409；媒体引用删除 409；
// CSRF 403；删除产品后询价快照保留；sitemap/robots。
package itest

import (
	"bytes"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"seamcap/internal/captcha"
	"seamcap/internal/handler/admin"
	"seamcap/internal/handler/public"
	"seamcap/internal/secret"
	"seamcap/internal/service"
	"seamcap/internal/testutil"
)

type server struct {
	*httptest.Server
	env     *testutil.Env
	mux     *chi.Mux
	auth    *service.AuthService
	captcha *captcha.Manager
}

func newServer(t *testing.T) *server {
	t.Helper()
	env := testutil.NewEnv(t)
	// 预置管理员
	hash, err := service.HashPassword("password1234")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := env.Repos.Admin.CreateAdmin("admin", hash); err != nil {
		t.Fatal(err)
	}
	sec, err := secret.LoadOrCreateSecret(env.Cfg.SecretFile)
	if err != nil {
		t.Fatal(err)
	}
	auth := service.NewAuthService(env.Cfg, env.Repos.Admin, env.Repos.Audit, sec)
	prods := service.NewProductService(env.Repos.Prod, env.Repos.Cat, env.Repos.Media)
	cats := service.NewCategoryService(env.Repos.Cat, env.Repos.Prod, env.Repos.Media)
	media := service.NewMediaService(env.Repos.Media, env.Store, env.Cfg.MaxImageMB, env.Cfg.MaxVideoMB)
	crafts := service.NewCraftService(env.Repos.Craft, env.Repos.Media)
	pages := service.NewPageService(env.Repos.Page)
	home := service.NewHomeService(env.Repos.Home, env.Repos.Media, env.Repos.Prod, env.Repos.Craft)
	settings := service.NewSettingsService(env.Repos.Settings)
	inqs := service.NewInquiryService(env.Repos.Inq, env.Repos.Prod, env.Mail, env.Cfg.RateLimitInquiryPerHour)
	inqs.MinInterval = 0
	dash := service.NewDashboardService(env.Repos.Prod, env.Repos.Craft, env.Repos.Inq)

	pubH := &public.Public{
		Settings: settings, Home: home, Products: prods, Cats: cats,
		Crafts: crafts, Pages: pages, Inqs: inqs,
		DB: env.DB, BaseURL: env.Cfg.BaseURL,
	}
	captchaMgr := captcha.NewManager(5 * time.Minute)
	admH := &admin.Admin{
		Auth: auth, Prods: prods, Cats: cats, Media: media, Crafts: crafts,
		Pages: pages, Home: home, Settings: settings, Inqs: inqs, Dash: dash,
		Audit: env.Repos.Audit, Mail: env.Mail,
		Captcha: captchaMgr,
		Cfg:     env.Cfg, DB: env.DB,
	}

	mux := chi.NewRouter()
	mux.Mount("/api/v1", pubH.Routes())
	mux.Mount("/api/v1/admin", admH.Routes())
	mux.Get("/sitemap.xml", pubH.Sitemap)
	mux.Get("/robots.txt", pubH.Robots)

	ts := httptest.NewServer(mux)
	t.Cleanup(ts.Close)
	return &server{Server: ts, env: env, mux: mux, auth: auth, captcha: captchaMgr}
}

// ---- 请求辅助 ----

func (s *server) do(t *testing.T, client *http.Client, method, path string, body io.Reader, hdr map[string]string) (int, map[string]any, []byte) {
	t.Helper()
	req, err := http.NewRequest(method, s.URL+path, body)
	if err != nil {
		t.Fatal(err)
	}
	for k, v := range hdr {
		req.Header.Set(k, v)
	}
	if body != nil && req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	var parsed map[string]any
	_ = json.Unmarshal(raw, &parsed)
	return resp.StatusCode, parsed, raw
}

// adminClient 登录后的客户端（Cookie Jar + CSRF token）。验证码由服务端直接签发。
func (s *server) adminClient(t *testing.T) (*http.Client, string) {
	t.Helper()
	jar, _ := cookiejar.New(nil)
	client := &http.Client{Jar: jar}
	ch, err := s.captcha.NewChallenge("127.0.0.1")
	if err != nil {
		t.Fatalf("captcha: %v", err)
	}
	payload, _ := json.Marshal(map[string]string{
		"username": "admin", "password": "password1234",
		"captcha_id": ch.ID, "captcha_code": ch.Answer,
	})
	code, body, _ := s.do(t, client, "POST", "/api/v1/admin/login",
		strings.NewReader(string(payload)), nil)
	if code != 200 {
		t.Fatalf("login failed: %d %v", code, body)
	}
	data := body["data"].(map[string]any)
	csrf := data["csrf_token"].(string)
	return client, csrf
}

func hdrCSRF(csrf string) map[string]string {
	return map[string]string{"X-CSRF-Token": csrf}
}

func pngMultipart(t *testing.T, w, h int, alt string) (*bytes.Buffer, string) {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	img.Set(0, 0, color.RGBA{10, 20, 30, 255})
	var pngBuf bytes.Buffer
	if err := png.Encode(&pngBuf, img); err != nil {
		t.Fatal(err)
	}
	var body bytes.Buffer
	mp := multipart.NewWriter(&body)
	fw, _ := mp.CreateFormFile("file", "test.png")
	if _, err := fw.Write(pngBuf.Bytes()); err != nil {
		t.Fatal(err)
	}
	mp.WriteField("alt_text", alt)
	if err := mp.Close(); err != nil {
		t.Fatal(err)
	}
	return &body, mp.FormDataContentType()
}

// ---- 测试 ----

func TestHealth(t *testing.T) {
	s := newServer(t)
	code, body, _ := s.do(t, http.DefaultClient, "GET", "/api/v1/health", nil, nil)
	if code != 200 || body["status"] != "ok" {
		t.Fatalf("health: %d %v", code, body)
	}
}

func TestAdminRequiresAuth(t *testing.T) {
	s := newServer(t)
	var code int
	for _, path := range []string{
		"/api/v1/admin/dashboard", "/api/v1/admin/products", "/api/v1/admin/settings",
	} {
		code, _, _ = s.do(t, http.DefaultClient, "GET", path, nil, nil)
		if code != 401 {
			t.Errorf("%s without auth: want 401, got %d", path, code)
		}
	}
	// 写接口无 CSRF → 403
	client, csrf := s.adminClient(t)
	code, _, _ = s.do(t, client, "POST", "/api/v1/admin/categories",
		strings.NewReader(`{"name":"X","status":"active"}`), nil)
	if code != 403 {
		t.Errorf("missing CSRF should be 403, got %d", code)
	}
	// 带 CSRF 成功
	code, _, _ = s.do(t, client, "POST", "/api/v1/admin/categories",
		strings.NewReader(`{"name":"X","status":"active"}`), hdrCSRF(csrf))
	if code != 201 {
		t.Errorf("with CSRF should be 201, got %d", code)
	}
	_ = csrf
}

func TestProductLifecycleAndVisibility(t *testing.T) {
	s := newServer(t)
	client, csrf := s.adminClient(t)
	h := hdrCSRF(csrf)

	// 建分类 + 产品（published）
	code, body, _ := s.do(t, client, "POST", "/api/v1/admin/categories",
		strings.NewReader(`{"name":"Solid Color","name_en":"Solid Color","status":"active"}`), h)
	if code != 201 {
		t.Fatalf("create category: %d %v", code, body)
	}
	catID := int64(body["data"].(map[string]any)["id"].(float64))

	code, body, _ = s.do(t, client, "POST", "/api/v1/admin/products",
		strings.NewReader(`{"name":"LG260008 Solid Cap","sku":"LG260008","slug":"lg260008-solid-cap","status":"published","category_id":`+
			formatInt(catID)+`}`), h)
	if code != 201 {
		t.Fatalf("create product: %d %v", code, body)
	}

	// 公开列表可见
	code, body, _ = s.do(t, http.DefaultClient, "GET", "/api/v1/products", nil, nil)
	if code != 200 {
		t.Fatalf("public products: %d", code)
	}
	items := body["data"].([]any)
	if len(items) != 1 {
		t.Fatalf("want 1 public product, got %d", len(items))
	}

	// slug 冲突 → 409 + suggestion
	code, body, _ = s.do(t, client, "POST", "/api/v1/admin/products",
		strings.NewReader(`{"name":"Copy Cat","slug":"lg260008-solid-cap","status":"draft"}`), h)
	if code != 409 {
		t.Fatalf("slug conflict: want 409, got %d %v", code, body)
	}
	errObj := body["error"].(map[string]any)
	if errObj["fields"].(map[string]any)["suggestion"] == "" {
		t.Error("conflict should carry slug suggestion")
	}

	// 草稿对公开不可见
	code, body, _ = s.do(t, client, "POST", "/api/v1/admin/products",
		strings.NewReader(`{"name":"Secret Cap","status":"draft"}`), h)
	if code != 201 {
		t.Fatalf("create draft: %d %v", code, body)
	}
	draftSlug := body["data"].(map[string]any)["slug"].(string)
	code, _, _ = s.do(t, http.DefaultClient, "GET", "/api/v1/products/"+draftSlug, nil, nil)
	if code != 404 {
		t.Errorf("draft detail should be 404, got %d", code)
	}
	code, body, _ = s.do(t, http.DefaultClient, "GET", "/api/v1/products", nil, nil)
	if n := len(body["data"].([]any)); n != 1 {
		t.Errorf("public list should still have 1, got %d", n)
	}

	// 复制 → -copy 草稿
	code, body, _ = s.do(t, client, "POST", "/api/v1/admin/products/1/duplicate", nil, h)
	if code != 201 {
		t.Fatalf("duplicate: %d %v", code, body)
	}
	if slug := body["data"].(map[string]any)["slug"].(string); slug != "lg260008-solid-cap-copy" {
		t.Errorf("duplicate slug = %q", slug)
	}

	// 公开详情 200 + 分类名
	code, body, _ = s.do(t, http.DefaultClient, "GET", "/api/v1/products/lg260008-solid-cap", nil, nil)
	if code != 200 {
		t.Fatalf("public detail: %d", code)
	}
	detail := body["data"].(map[string]any)
	if detail["category"] == nil {
		t.Error("detail should embed category")
	}
}

func TestCategoryDeleteStrategiesOverHTTP(t *testing.T) {
	s := newServer(t)
	client, csrf := s.adminClient(t)
	h := hdrCSRF(csrf)

	s.do(t, client, "POST", "/api/v1/admin/categories",
		strings.NewReader(`{"name":"A","status":"active"}`), h)
	s.do(t, client, "POST", "/api/v1/admin/categories",
		strings.NewReader(`{"name":"B","status":"active"}`), h)
	s.do(t, client, "POST", "/api/v1/admin/products",
		strings.NewReader(`{"name":"P","status":"draft","category_id":1}`), h)

	// 直接删 → 409
	code, body, _ := s.do(t, client, "DELETE", "/api/v1/admin/categories/1", nil, h)
	if code != 409 {
		t.Fatalf("delete non-empty: want 409, got %d %v", code, body)
	}
	fields := body["error"].(map[string]any)["fields"].(map[string]any)
	if fields["product_count"] != "1" {
		t.Errorf("product_count = %v", fields["product_count"])
	}
	// reassign → 200
	code, _, _ = s.do(t, client, "DELETE", "/api/v1/admin/categories/1?mode=reassign&to=2", nil, h)
	if code != 200 {
		t.Fatalf("reassign delete: %d", code)
	}
	// archive → 200
	code, body, _ = s.do(t, client, "DELETE", "/api/v1/admin/categories/2?mode=archive", nil, h)
	if code != 200 {
		t.Fatalf("archive: %d %v", code, body)
	}
}

func TestMediaLifecycleOverHTTP(t *testing.T) {
	s := newServer(t)
	client, csrf := s.adminClient(t)
	h := hdrCSRF(csrf)

	payload, ctype := pngMultipart(t, 6, 6, "a red pixel")
	code, body, _ := s.do(t, client, "POST", "/api/v1/admin/media", bytes.NewReader(payload.Bytes()),
		map[string]string{"Content-Type": ctype, "X-CSRF-Token": csrf})
	if code != 201 {
		t.Fatalf("upload: %d %v", code, body)
	}
	mediaID := int64(body["data"].(map[string]any)["id"].(float64))
	url := body["data"].(map[string]any)["url"].(string)
	if !strings.HasPrefix(url, "/uploads/") {
		t.Errorf("url = %q", url)
	}

	// 建产品并关联为主图
	s.do(t, client, "POST", "/api/v1/admin/products",
		strings.NewReader(`{"name":"With Pic","status":"published"}`), h)
	code, _, _ = s.do(t, client, "PUT", "/api/v1/admin/products/1/media",
		strings.NewReader(`{"items":[{"media_id":1,"role":"main","sort_order":0}]}`), h)
	if code != 200 {
		t.Fatalf("set media: %d", code)
	}

	// 引用中删除 → 409 + 引用来源
	code, body, _ = s.do(t, client, "DELETE", "/api/v1/admin/media/1", nil, h)
	if code != 409 {
		t.Fatalf("delete referenced media: want 409, got %d %v", code, body)
	}
	fields := body["error"].(map[string]any)["fields"].(map[string]any)
	if fields["references"] == "" {
		t.Error("references should be listed in 409")
	}

	// 解除引用后可删除
	s.do(t, client, "PUT", "/api/v1/admin/products/1/media", strings.NewReader(`{"items":[]}`), h)
	code, _, _ = s.do(t, client, "DELETE", "/api/v1/admin/media/1", nil, h)
	if code != 200 {
		t.Errorf("delete unreferenced media: %d", code)
	}
	_ = mediaID
}

func TestInquiryFlowOverHTTP(t *testing.T) {
	s := newServer(t)
	client, csrf := s.adminClient(t)
	h := hdrCSRF(csrf)

	// 已发布产品
	s.do(t, client, "POST", "/api/v1/admin/products",
		strings.NewReader(`{"name":"Quotable Cap","sku":"LG260008","status":"published"}`), h)

	// 正常提交（同源 Origin）
	code, body, _ := s.do(t, http.DefaultClient, "POST", "/api/v1/inquiries",
		strings.NewReader(`{"name":"John","email":"john@buyer.com","message":"Please send me a quotation for 5000 pcs.","product_id":1}`),
		map[string]string{"Origin": s.URL})
	if code != 201 {
		t.Fatalf("submit inquiry: %d %v", code, body)
	}

	// 跨源 Origin → 403
	code, _, _ = s.do(t, http.DefaultClient, "POST", "/api/v1/inquiries",
		strings.NewReader(`{"name":"John","email":"john@buyer.com","message":"Please send me a quotation for 5000 pcs."}`),
		map[string]string{"Origin": "https://evil.example"})
	if code != 403 {
		t.Errorf("cross-origin inquiry should be 403, got %d", code)
	}

	// honeypot → 伪装成功但不落库
	code, body, _ = s.do(t, http.DefaultClient, "POST", "/api/v1/inquiries",
		strings.NewReader(`{"name":"Spam Bot","email":"bot@spam.com","message":"buy my stuff please!!!","website":"http://spam"}`),
		map[string]string{"Origin": s.URL})
	if code != 201 {
		t.Fatalf("honeypot should fake success: %d", code)
	}
	if id := body["data"].(map[string]any)["id"].(float64); id != 0 {
		t.Errorf("honeypot fake id should be 0, got %v", id)
	}

	// 后台可见 1 条（非 honeypot）
	code, body, _ = s.do(t, client, "GET", "/api/v1/admin/inquiries", nil, h)
	if code != 200 {
		t.Fatalf("admin inquiries: %d", code)
	}
	if total := body["pagination"].(map[string]any)["total"].(float64); total != 1 {
		t.Errorf("want 1 inquiry, got %v", total)
	}

	// 删除产品 → 快照保留
	s.do(t, client, "DELETE", "/api/v1/admin/products/1", nil, h)
	code, body, _ = s.do(t, client, "GET", "/api/v1/admin/inquiries/1", nil, h)
	if code != 200 {
		t.Fatalf("inquiry detail: %d", code)
	}
	q := body["data"].(map[string]any)["inquiry"].(map[string]any)
	if q["product_name_snapshot"] != "Quotable Cap" || q["product_sku_snapshot"] != "LG260008" {
		t.Errorf("snapshot lost: %v %v", q["product_name_snapshot"], q["product_sku_snapshot"])
	}
}

func TestSitemapAndRobots(t *testing.T) {
	s := newServer(t)
	client, csrf := s.adminClient(t)
	h := hdrCSRF(csrf)
	s.do(t, client, "POST", "/api/v1/admin/products",
		strings.NewReader(`{"name":"Visible Cap","status":"published"}`), h)
	s.do(t, client, "POST", "/api/v1/admin/products",
		strings.NewReader(`{"name":"Hidden Cap","status":"draft"}`), h)

	_, _, raw := s.do(t, http.DefaultClient, "GET", "/sitemap.xml", nil, nil)
	sm := string(raw)
	if !strings.Contains(sm, "/products/visible-cap/") {
		t.Error("sitemap should contain published product")
	}
	if strings.Contains(sm, "hidden-cap") {
		t.Error("sitemap must not contain draft product")
	}
	if strings.Contains(sm, "/admin/") {
		t.Error("sitemap must not contain admin")
	}

	_, _, raw = s.do(t, http.DefaultClient, "GET", "/robots.txt", nil, nil)
	if !strings.Contains(string(raw), "Disallow: /admin/") {
		t.Errorf("robots.txt missing admin disallow: %s", string(raw))
	}
}

func TestDashboardAndBackup(t *testing.T) {
	s := newServer(t)
	client, csrf := s.adminClient(t)
	h := hdrCSRF(csrf)
	s.do(t, client, "POST", "/api/v1/admin/products",
		strings.NewReader(`{"name":"D1","status":"published"}`), h)

	code, body, _ := s.do(t, client, "GET", "/api/v1/admin/dashboard", nil, h)
	if code != 200 {
		t.Fatalf("dashboard: %d", code)
	}
	data := body["data"].(map[string]any)
	if data["products"].(map[string]any)["published"] != float64(1) {
		t.Errorf("dashboard published count wrong: %v", data["products"])
	}

	// 备份（VACUUM INTO）
	code, body, _ = s.do(t, client, "POST", "/api/v1/admin/backup", nil, h)
	if code != 201 {
		t.Fatalf("backup: %d %v", code, body)
	}
	file := body["data"].(map[string]any)["file"].(string)
	if !strings.Contains(file, "db-") {
		t.Errorf("backup file = %q", file)
	}
}

func TestInquiryExportCSVOverHTTP(t *testing.T) {
	s := newServer(t)
	s.do(t, http.DefaultClient, "POST", "/api/v1/inquiries",
		strings.NewReader(`{"name":"John","email":"john@buyer.com","message":"Please send me a quotation for 5000 pcs."}`),
		map[string]string{"Origin": s.URL})
	client, csrf := s.adminClient(t)
	_, _, raw := s.do(t, client, "GET", "/api/v1/admin/inquiries/export", nil, hdrCSRF(csrf))
	if len(raw) < 3 || raw[0] != 0xEF || raw[1] != 0xBB || raw[2] != 0xBF {
		t.Error("export must start with UTF-8 BOM")
	}
	if !strings.Contains(string(raw), "john@buyer.com") {
		t.Error("export should contain the inquiry email")
	}
}

func formatInt(n int64) string {
	return strconv.FormatInt(n, 10)
}
