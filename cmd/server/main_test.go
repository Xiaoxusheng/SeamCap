package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

func TestAdminSPAHandlerSecurityHeaders(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("<!doctype html><html></html>"), 0o644); err != nil {
		t.Fatal(err)
	}
	h := adminSPAHandler(dir)
	if h == nil {
		t.Fatal("adminSPAHandler returned nil")
	}
	for _, path := range []string{"/admin", "/admin/", "/admin/products"} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		if rec.Code != http.StatusOK {
			t.Fatalf("%s: status = %d, want 200", path, rec.Code)
		}
		if got := rec.Header().Get("Content-Security-Policy"); got != adminCSP {
			t.Errorf("%s: CSP = %q", path, got)
		}
		if got := rec.Header().Get("X-Frame-Options"); got != "DENY" {
			t.Errorf("%s: X-Frame-Options = %q, want DENY", path, got)
		}
		if got := rec.Header().Get("X-Robots-Tag"); got != "noindex" {
			t.Errorf("%s: X-Robots-Tag = %q, want noindex", path, got)
		}
	}
}

// TestAdminCSPCoversInlineThemeScript 防止 Vite 重建后内联主题脚本哈希与 CSP 脱节。
func TestAdminCSPCoversInlineThemeScript(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join("..", "..", "web", "admin", "index.html"))
	if err != nil {
		t.Skipf("admin build not available: %v", err)
	}
	re := regexp.MustCompile(`(?s)<script(?:\s[^>]*)?>(.*?)</script>`)
	for _, m := range re.FindAllSubmatch(raw, -1) {
		// HTML 解析器会先把 CRLF/CR 归一化为 LF，再计算 CSP 哈希。
		body := bytes.ReplaceAll(m[1], []byte("\r\n"), []byte("\n"))
		body = bytes.ReplaceAll(body, []byte("\r"), []byte("\n"))
		if len(bytes.TrimSpace(body)) == 0 {
			continue // 外链脚本没有内联内容
		}
		sum := sha256.Sum256(body)
		want := "'sha256-" + base64.StdEncoding.EncodeToString(sum[:]) + "'"
		if !strings.Contains(adminCSP, want) {
			t.Fatalf("adminCSP 未覆盖内联脚本哈希，请更新 adminCSP 加入 %s", want)
		}
	}
}
