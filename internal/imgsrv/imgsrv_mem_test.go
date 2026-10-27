package imgsrv

import (
	"image"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"testing"
)

// 源图超过单边/像素保护上限时不缩放，回退原图（避免解压炸弹把内存顶爆）。
func TestOversizeSourceFallsBackToOriginal(t *testing.T) {
	h, uploads, cache := newTestHandler(t)
	const rel = "2026/10/000T2VCSWVB8RRP42AFBSNR5ZP.jpg"
	writeTestImage(t, uploads, rel, maxDecodeDim+100, 8)

	rec := doReq(h, "/uploads/"+rel+"?w=320")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	img, _, err := image.Decode(rec.Body)
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	if b := img.Bounds(); b.Dx() != maxDecodeDim+100 {
		t.Fatalf("oversize source should be served untouched, got width %d", b.Dx())
	}
	if _, err := os.Stat(filepath.Join(cache, "320", filepath.FromSlash(rel))); err == nil {
		t.Fatal("oversize source must not produce a scaled cache file")
	}
}

// 同一目标并发命中时只应生成一次，且所有请求都拿到正确的缩放结果。
func TestConcurrentSameTarget(t *testing.T) {
	h, _, cache := newTestHandler(t)
	const target = "/uploads/2026/10/000T2VCSWQH59KTFKB8NPDX2R2.jpg?w=320"

	var wg sync.WaitGroup
	errs := make(chan string, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			rec := doReq(h, target)
			if rec.Code != http.StatusOK {
				errs <- "status " + http.StatusText(rec.Code)
				return
			}
			img, _, err := image.Decode(rec.Body)
			if err != nil {
				errs <- "decode: " + err.Error()
				return
			}
			if b := img.Bounds(); b.Dx() != 320 || b.Dy() != 240 {
				errs <- "wrong size"
			}
		}()
	}
	wg.Wait()
	close(errs)
	for msg := range errs {
		t.Fatal(msg)
	}
	if _, err := os.Stat(filepath.Join(cache, "320", "2026", "10", "000T2VCSWQH59KTFKB8NPDX2R2.jpg")); err != nil {
		t.Fatalf("cache file missing after concurrent requests: %v", err)
	}
}
