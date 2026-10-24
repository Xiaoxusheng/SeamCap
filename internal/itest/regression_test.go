package itest

import (
	"bytes"
	"crypto/rand"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	mw "seamcap/internal/middleware"
)

func largePNGMultipart(t *testing.T) (*bytes.Buffer, string, []byte) {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 300, 300))
	noise := make([]byte, 300*300*4)
	if _, err := rand.Read(noise); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 300*300; i++ {
		img.Set(i%300, i/300, color.RGBA{noise[i*4], noise[i*4+1], noise[i*4+2], 255})
	}
	var pngBuf bytes.Buffer
	if err := png.Encode(&pngBuf, img); err != nil {
		t.Fatal(err)
	}
	data := pngBuf.Bytes()

	var body bytes.Buffer
	mp := multipart.NewWriter(&body)
	fw, _ := mp.CreateFormFile("file", "big.png")
	if _, err := fw.Write(data); err != nil {
		t.Fatal(err)
	}
	if err := mp.Close(); err != nil {
		t.Fatal(err)
	}
	return &body, mp.FormDataContentType(), data
}

// 端到端回归：大图经 multipart → service 嗅探 → storage 落盘后必须逐字节一致。
func TestUploadLargeImagePersistsIntact(t *testing.T) {
	s := newServer(t)
	client, csrf := s.adminClient(t)
	payload, ctype, data := largePNGMultipart(t)

	code, body, _ := s.do(t, client, "POST", "/api/v1/admin/media", bytes.NewReader(payload.Bytes()),
		map[string]string{"Content-Type": ctype, "X-CSRF-Token": csrf})
	if code != 201 {
		t.Fatalf("upload: %d %v", code, body)
	}
	media := body["data"].(map[string]any)
	url, _ := media["url"].(string)
	if size, _ := media["size_bytes"].(float64); int(size) != len(data) {
		t.Errorf("size_bytes = %v, want %d", media["size_bytes"], len(data))
	}
	disk := filepath.Join(s.env.Cfg.UploadDir, filepath.FromSlash(strings.TrimPrefix(url, "/uploads/")))
	saved, err := os.ReadFile(disk)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(saved, data) {
		t.Errorf("stored file corrupted: %d bytes on disk, %d expected", len(saved), len(data))
	}
}

func TestEmptyListsSerializeAsArrays(t *testing.T) {
	s := newServer(t)
	client, csrf := s.adminClient(t)
	h := hdrCSRF(csrf)

	paths := []string{
		"/api/v1/products", "/api/v1/categories", "/api/v1/craftsmanship",
		"/api/v1/admin/craftsmanship", "/api/v1/admin/pages", "/api/v1/admin/media",
		"/api/v1/admin/inquiries", "/api/v1/admin/audit-logs",
	}
	for _, p := range paths {
		code, body, _ := s.do(t, client, "GET", p, nil, h)
		if code != 200 {
			t.Errorf("%s: %d", p, code)
			continue
		}
		if body["data"] == nil {
			t.Errorf("%s: data is null, want []", p)
		}
	}

	// 聚合响应里的嵌套列表也不能是 null
	code, body, _ := s.do(t, client, "GET", "/api/v1/home", nil, h)
	if code != 200 {
		t.Fatalf("home: %d", code)
	}
	home := body["data"].(map[string]any)
	if home["featured_products"] == nil || home["craft_preview"] == nil {
		t.Errorf("home nested lists should be arrays: %v", home)
	}
	code, body, _ = s.do(t, client, "GET", "/api/v1/admin/dashboard", nil, h)
	if code != 200 {
		t.Fatalf("dashboard: %d", code)
	}
	dash := body["data"].(map[string]any)
	if dash["recent_inquiries"] == nil || dash["recent_products"] == nil {
		t.Errorf("dashboard nested lists should be arrays: %v", dash)
	}
}

func TestInvalidPathIDReturns400(t *testing.T) {
	s := newServer(t)
	client, csrf := s.adminClient(t)
	code, body, _ := s.do(t, client, "GET", "/api/v1/admin/products/abc", nil, hdrCSRF(csrf))
	if code != 400 {
		t.Errorf("invalid id: want 400, got %d %v", code, body)
	}
}

func TestOversizedJSONReturns413(t *testing.T) {
	s := newServer(t)
	big := strings.Repeat("a", 1<<20+1024)
	payload := `{"name":"x","email":"x@example.com","message":"` + big + `"}`
	req := httptest.NewRequest("POST", "/api/v1/inquiries", strings.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	s.mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusRequestEntityTooLarge {
		var parsed map[string]any
		_ = json.Unmarshal(rec.Body.Bytes(), &parsed)
		t.Errorf("want 413, got %d %v", rec.Code, parsed)
	}
}
func TestCrossOriginLoginRejected(t *testing.T) {
	s := newServer(t)
	ch, err := s.captcha.NewChallenge("127.0.0.1")
	if err != nil {
		t.Fatal(err)
	}
	payload, _ := json.Marshal(map[string]string{
		"username": "admin", "password": "password1234",
		"captcha_id": ch.ID, "captcha_code": ch.Answer,
	})
	code, body, _ := s.do(t, http.DefaultClient, "POST", "/api/v1/admin/login",
		strings.NewReader(string(payload)), map[string]string{"Origin": "https://evil.example"})
	if code != 403 {
		t.Errorf("cross-origin login: want 403, got %d %v", code, body)
	}

	// 同源 Origin 正常放行（需带上有效验证码）
	ch2, err := s.captcha.NewChallenge("127.0.0.1")
	if err != nil {
		t.Fatal(err)
	}
	payload, _ = json.Marshal(map[string]string{
		"username": "admin", "password": "password1234",
		"captcha_id": ch2.ID, "captcha_code": ch2.Answer,
	})
	code, body, _ = s.do(t, http.DefaultClient, "POST", "/api/v1/admin/login",
		strings.NewReader(string(payload)), map[string]string{"Origin": s.URL})
	if code != 200 {
		t.Errorf("same-origin login: want 200, got %d %v", code, body)
	}
}

func TestCaptchaRequiredForLogin(t *testing.T) {
	s := newServer(t)

	// 验证码端点：返回 id + data URL PNG
	code, body, _ := s.do(t, http.DefaultClient, "GET", "/api/v1/admin/captcha", nil, nil)
	if code != 200 {
		t.Fatalf("captcha endpoint: %d %v", code, body)
	}
	data := body["data"].(map[string]any)
	if id, _ := data["id"].(string); id == "" {
		t.Error("captcha id is empty")
	}
	if img, _ := data["image"].(string); !strings.HasPrefix(img, "data:image/png;base64,") {
		t.Errorf("captcha image is not a png data url: %.40q", img)
	}

	// 缺少验证码 → 400 + captcha_code 字段
	code, body, _ = s.do(t, http.DefaultClient, "POST", "/api/v1/admin/login",
		strings.NewReader(`{"username":"admin","password":"password1234"}`), nil)
	if code != 400 {
		t.Fatalf("login without captcha: want 400, got %d %v", code, body)
	}
	fields := body["error"].(map[string]any)["fields"].(map[string]any)
	if fields["captcha_code"] == nil {
		t.Errorf("missing captcha_code field error: %v", fields)
	}

	// 错误验证码 → 400
	chWrong, err := s.captcha.NewChallenge("127.0.0.1")
	if err != nil {
		t.Fatal(err)
	}
	wrong := "0000"
	if chWrong.Answer == wrong {
		wrong = "1111"
	}
	payload, _ := json.Marshal(map[string]string{
		"username": "admin", "password": "password1234",
		"captcha_id": chWrong.ID, "captcha_code": wrong,
	})
	code, _, _ = s.do(t, http.DefaultClient, "POST", "/api/v1/admin/login", strings.NewReader(string(payload)), nil)
	if code != 400 {
		t.Errorf("wrong captcha: want 400, got %d", code)
	}

	// 正确验证码 → 200；同一挑战不可复用
	ch, err := s.captcha.NewChallenge("127.0.0.1")
	if err != nil {
		t.Fatal(err)
	}
	payload, _ = json.Marshal(map[string]string{
		"username": "admin", "password": "password1234",
		"captcha_id": ch.ID, "captcha_code": ch.Answer,
	})
	code, body, _ = s.do(t, http.DefaultClient, "POST", "/api/v1/admin/login", strings.NewReader(string(payload)), nil)
	if code != 200 {
		t.Fatalf("correct captcha login: want 200, got %d %v", code, body)
	}
	code, _, _ = s.do(t, http.DefaultClient, "POST", "/api/v1/admin/login", strings.NewReader(string(payload)), nil)
	if code != 400 {
		t.Errorf("captcha must be single-use, second login got %d", code)
	}
}

func TestOversizedUploadReturns413(t *testing.T) {
	s := newServer(t)
	client, csrf := s.adminClient(t)

	var body bytes.Buffer
	mp := multipart.NewWriter(&body)
	fw, _ := mp.CreateFormFile("file", "huge.png")
	chunk := bytes.Repeat([]byte{0xAB}, 1<<20)
	for i := 0; i < 8; i++ { // 8MB，超过测试配置的 MaxVideoMB(5)+2 MB 上限
		if _, err := fw.Write(chunk); err != nil {
			t.Fatal(err)
		}
	}
	if err := mp.Close(); err != nil {
		t.Fatal(err)
	}
	code, resp, _ := s.do(t, client, "POST", "/api/v1/admin/media", bytes.NewReader(body.Bytes()),
		map[string]string{"Content-Type": mp.FormDataContentType(), "X-CSRF-Token": csrf})
	if code != 413 {
		t.Errorf("oversized upload: want 413, got %d %v", code, resp)
	}
}

// “记住登录”通过更长的会话与 Cookie Max-Age 实现，不保存密码。
func TestRememberLoginCookieTTL(t *testing.T) {
	s := newServer(t)
	login := func(remember bool) *http.Cookie {
		t.Helper()
		ch, err := s.captcha.NewChallenge("127.0.0.1")
		if err != nil {
			t.Fatal(err)
		}
		payload, _ := json.Marshal(map[string]any{
			"username": "admin", "password": "password1234",
			"captcha_id": ch.ID, "captcha_code": ch.Answer, "remember": remember,
		})
		req, err := http.NewRequest("POST", s.URL+"/api/v1/admin/login", bytes.NewReader(payload))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/json")
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != 200 {
			t.Fatalf("login (remember=%v): %d", remember, resp.StatusCode)
		}
		for _, c := range resp.Cookies() {
			if c.Name == mw.SessionCookieName {
				return c
			}
		}
		t.Fatal("session cookie missing")
		return nil
	}

	remembered := login(true)
	if want := int(s.env.Cfg.RememberTTL.Seconds()); remembered.MaxAge != want {
		t.Errorf("remember cookie MaxAge = %d, want %d", remembered.MaxAge, want)
	}
	if !remembered.HttpOnly {
		t.Error("session cookie must be HttpOnly")
	}
	short := login(false)
	if want := int(s.env.Cfg.SessionTTL.Seconds()); short.MaxAge != want {
		t.Errorf("normal cookie MaxAge = %d, want %d", short.MaxAge, want)
	}
}
