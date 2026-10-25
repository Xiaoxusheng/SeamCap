package imgsrv

import (
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

// writeTestImage 生成 w x h 测试图到 dir/rel（按 ext 编码 jpeg/png）。
func writeTestImage(t *testing.T, dir, rel string, w, h int) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(filepath.Join(dir, rel)), 0o755); err != nil {
		t.Fatal(err)
	}
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{uint8(x % 256), uint8(y % 256), 128, 255})
		}
	}
	f, err := os.Create(filepath.Join(dir, rel))
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if filepath.Ext(rel) == ".png" {
		if err := png.Encode(f, img); err != nil {
			t.Fatal(err)
		}
	} else {
		if err := jpeg.Encode(f, img, &jpeg.Options{Quality: 90}); err != nil {
			t.Fatal(err)
		}
	}
}

func newTestHandler(t *testing.T) (*Handler, string, string) {
	t.Helper()
	uploads := t.TempDir()
	cache := t.TempDir()
	writeTestImage(t, uploads, "2026/10/000T2VCSWQH59KTFKB8NPDX2R2.jpg", 800, 600)
	h := New(uploads, "/uploads/", cache, "public, max-age=31536000, immutable")
	if h == nil {
		t.Fatal("handler should not be nil")
	}
	return h, uploads, cache
}

func doReq(h *Handler, target string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, target, nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestScaledOutput(t *testing.T) {
	h, _, cache := newTestHandler(t)
	rec := doReq(h, "/uploads/2026/10/000T2VCSWQH59KTFKB8NPDX2R2.jpg?w=320")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "image/jpeg" {
		t.Fatalf("content-type = %q, want image/jpeg", ct)
	}
	// 缩放缓存已落盘
	if _, err := os.Stat(filepath.Join(cache, "320", "2026", "10", "000T2VCSWQH59KTFKB8NPDX2R2.jpg")); err != nil {
		t.Fatalf("scaled cache file missing: %v", err)
	}
}

func TestScaledDimensions(t *testing.T) {
	h, _, _ := newTestHandler(t)
	rec := doReq(h, "/uploads/2026/10/000T2VCSWQH59KTFKB8NPDX2R2.jpg?w=320")
	img, _, err := image.Decode(rec.Body)
	if err != nil {
		t.Fatalf("decode scaled output: %v", err)
	}
	b := img.Bounds()
	if b.Dx() != 320 || b.Dy() != 240 {
		t.Fatalf("scaled size = %dx%d, want 320x240", b.Dx(), b.Dy())
	}
}

func TestNoParamServesOriginal(t *testing.T) {
	h, _, _ := newTestHandler(t)
	rec := doReq(h, "/uploads/2026/10/000T2VCSWQH59KTFKB8NPDX2R2.jpg")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	img, _, err := image.Decode(rec.Body)
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	if b := img.Bounds(); b.Dx() != 800 || b.Dy() != 600 {
		t.Fatalf("size = %dx%d, want original 800x600", b.Dx(), b.Dy())
	}
}

func TestInvalidWidthServesOriginal(t *testing.T) {
	h, _, _ := newTestHandler(t)
	for _, q := range []string{"?w=500", "?w=abc", "?w=99999999"} {
		rec := doReq(h, "/uploads/2026/10/000T2VCSWQH59KTFKB8NPDX2R2.jpg"+q)
		if rec.Code != http.StatusOK {
			t.Fatalf("q=%s status = %d, want 200", q, rec.Code)
		}
		img, _, _ := image.Decode(rec.Body)
		if b := img.Bounds(); b.Dx() != 800 {
			t.Fatalf("q=%s width = %d, want original 800", q, b.Dx())
		}
	}
}

func TestTraversalBlocked(t *testing.T) {
	h, _, _ := newTestHandler(t)
	rec := doReq(h, "/uploads/2026/10/..%2F..%2Fsecret.jpg?w=320")
	if rec.Code == http.StatusOK {
		t.Fatalf("traversal should not succeed, got %d", rec.Code)
	}
}

func TestNonScalingTypeServedAsIs(t *testing.T) {
	h, uploads, _ := newTestHandler(t)
	writeTestImage(t, uploads, "2026/10/000T2VCSWVB8RRP42AFBSNR5ZP.png", 500, 400)
	rec := doReq(h, "/uploads/2026/10/000T2VCSWVB8RRP42AFBSNR5ZP.png?w=160")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "image/png" {
		t.Fatalf("content-type = %q, want image/png", ct)
	}
	img, _, _ := image.Decode(rec.Body)
	if b := img.Bounds(); b.Dx() != 160 {
		t.Fatalf("png scaled width = %d, want 160", b.Dx())
	}
}

func TestPNGKeepsFormat(t *testing.T) {
	h, uploads, _ := newTestHandler(t)
	writeTestImage(t, uploads, "2026/10/000T2VCSWVB8RRP42AFBSNR5ZP.png", 500, 400)
	rec := doReq(h, "/uploads/2026/10/000T2VCSWVB8RRP42AFBSNR5ZP.png")
	if ct := rec.Header().Get("Content-Type"); ct != "image/png" {
		t.Fatalf("content-type = %q, want image/png", ct)
	}
}

func TestCacheHitAfterFirstRequest(t *testing.T) {
	h, _, cache := newTestHandler(t)
	_ = doReq(h, "/uploads/2026/10/000T2VCSWQH59KTFKB8NPDX2R2.jpg?w=480")
	st1, err := os.Stat(filepath.Join(cache, "480", "2026", "10", "000T2VCSWQH59KTFKB8NPDX2R2.jpg"))
	if err != nil {
		t.Fatalf("first request should create cache: %v", err)
	}
	rec := doReq(h, "/uploads/2026/10/000T2VCSWQH59KTFKB8NPDX2R2.jpg?w=480")
	if rec.Code != http.StatusOK {
		t.Fatalf("second request status = %d", rec.Code)
	}
	st2, _ := os.Stat(filepath.Join(cache, "480", "2026", "10", "000T2VCSWQH59KTFKB8NPDX2R2.jpg"))
	if !st1.ModTime().Equal(st2.ModTime()) {
		t.Fatalf("second request should reuse cache file")
	}
}

func TestMissingFileFallsBackToOriginal404(t *testing.T) {
	h, _, _ := newTestHandler(t)
	rec := doReq(h, "/uploads/2026/10/000T2VCSWXQGDYF4QN2YAVW7Q1.jpg?w=320")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}
