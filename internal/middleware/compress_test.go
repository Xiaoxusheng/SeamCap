package middleware

import (
	"bytes"
	"compress/gzip"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
)

func gzipRequest(t *testing.T, h http.Handler, target, accept, method string, hdr map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, target, nil)
	if accept != "" {
		req.Header.Set("Accept-Encoding", accept)
	}
	for k, v := range hdr {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func echoBody(ct string, body []byte) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", ct)
		w.Header().Set("Content-Length", strconv.Itoa(len(body)))
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(body)
	})
}

func TestCompressTextResponse(t *testing.T) {
	body := bytes.Repeat([]byte(`{"message":"hello world"}`), 40)
	rec := gzipRequest(t, Compress(echoBody("application/json; charset=utf-8", body)), "/api/v1/x", "gzip, deflate", http.MethodGet, nil)

	if got := rec.Header().Get("Content-Encoding"); got != "gzip" {
		t.Fatalf("Content-Encoding = %q, want gzip", got)
	}
	if got := rec.Header().Get("Content-Length"); got != "" {
		t.Fatalf("Content-Length should be removed, got %q", got)
	}
	if !strings.Contains(rec.Header().Get("Vary"), "Accept-Encoding") {
		t.Fatalf("missing Vary: %q", rec.Header().Get("Vary"))
	}
	zr, err := gzip.NewReader(bytes.NewReader(rec.Body.Bytes()))
	if err != nil {
		t.Fatalf("gzip reader: %v", err)
	}
	plain, err := io.ReadAll(zr)
	if err != nil {
		t.Fatalf("gunzip: %v", err)
	}
	if !bytes.Equal(plain, body) {
		t.Fatalf("decompressed body mismatch: %d vs %d bytes", len(plain), len(body))
	}
}

func TestCompressSkipsIncompressibleAndExplicitIdentities(t *testing.T) {
	body := bytes.Repeat([]byte{0xff, 0xd8, 0xff}, 100)
	cases := []struct {
		name   string
		accept string
		ct     string
		target string
		method string
		header map[string]string
	}{
		{"no accept-encoding", "", "text/html", "/", http.MethodGet, nil},
		{"gzip q=0", "gzip;q=0", "text/html", "/", http.MethodGet, nil},
		{"image type", "gzip", "image/jpeg", "/x", http.MethodGet, nil},
		{"uploads path", "gzip", "text/plain", "/uploads/a.txt", http.MethodGet, nil},
		{"head", "gzip", "text/html", "/", http.MethodHead, nil},
		{"range", "gzip", "text/css", "/x.css", http.MethodGet, map[string]string{"Range": "bytes=0-10"}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rec := gzipRequest(t, Compress(echoBody(c.ct, body)), c.target, c.accept, c.method, c.header)
			if got := rec.Header().Get("Content-Encoding"); got != "" {
				t.Fatalf("Content-Encoding = %q, want empty", got)
			}
		})
	}
}

func TestCompressSkipsSmallBodies(t *testing.T) {
	body := []byte(`{"ok":true}`)
	rec := gzipRequest(t, Compress(echoBody("application/json", body)), "/api/v1/x", "gzip", http.MethodGet, nil)
	if got := rec.Header().Get("Content-Encoding"); got != "" {
		t.Fatalf("small body should not be compressed, got %q", got)
	}
	if got := rec.Header().Get("Content-Length"); got != strconv.Itoa(len(body)) {
		t.Fatalf("Content-Length changed: %q", got)
	}
}

// 304 等非 200 响应不压缩，但仍要带 Vary（浏览器缓存需要按编码分桶）。
func TestCompressSkipsNon200ButSetsVary(t *testing.T) {
	h := Compress(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/css")
		w.WriteHeader(http.StatusNotModified)
	}))
	rec := gzipRequest(t, h, "/x.css", "gzip", http.MethodGet, nil)
	if got := rec.Header().Get("Content-Encoding"); got != "" {
		t.Fatalf("304 must not be compressed, got %q", got)
	}
	if !strings.Contains(rec.Header().Get("Vary"), "Accept-Encoding") {
		t.Fatalf("missing Vary on 304: %q", rec.Header().Get("Vary"))
	}
}

func TestAcceptsGzip(t *testing.T) {
	cases := map[string]bool{
		"":                        false,
		"gzip":                    true,
		"deflate, gzip":           true,
		"br;q=1, gzip;q=0.8":      true,
		"gzip;q=0":                false,
		"GZIP":                    true,
		"br":                      false,
		"deflate":                 false,
		"identity":                false,
		"gzip;q=0, deflate":       false,
		"br;q=1.0, gzip ; q=0.5 ": true,
	}
	for accept, want := range cases {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		if accept != "" {
			req.Header.Set("Accept-Encoding", accept)
		}
		if got := acceptsGzip(req); got != want {
			t.Fatalf("acceptsGzip(%q) = %v, want %v", accept, got, want)
		}
	}
}
