package middleware

import (
	"compress/gzip"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
)

// minCompressSize 低于该长度的响应不压缩（gzip 头 + 字典开销会吃掉收益）。
const minCompressSize = 512

// gzipPool 复用压缩器：每个 gzip.Writer 带约 1MB 的 deflate 状态，
// 每次请求新建会让 GC 压力变大，必须池化。
var gzipPool = sync.Pool{
	New: func() any {
		w, err := gzip.NewWriterLevel(io.Discard, gzip.DefaultCompression)
		if err != nil { // BestSpeed 是合法档位，这里不会失败
			panic(err)
		}
		return w
	},
}

// Compress 对文本类响应做 gzip（HTML/CSS/JS/JSON/SVG/XML）。
// 图片、视频、woff2 等已压缩格式原样透传；/uploads/ 整段跳过以保留 sendfile 零拷贝。
func Compress(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodHead ||
			!acceptsGzip(r) ||
			r.Header.Get("Range") != "" ||
			strings.HasPrefix(r.URL.Path, "/uploads/") {
			next.ServeHTTP(w, r)
			return
		}
		cw := &compressWriter{ResponseWriter: w}
		defer cw.close()
		next.ServeHTTP(cw, r)
	})
}

type compressWriter struct {
	http.ResponseWriter
	wroteHeader bool
	gz          *gzip.Writer
}

func (w *compressWriter) WriteHeader(code int) {
	if w.wroteHeader {
		return
	}
	w.wroteHeader = true
	h := w.Header()

	ct := h.Get("Content-Type")
	if !compressibleType(ct) {
		w.ResponseWriter.WriteHeader(code)
		return
	}
	// 缓存代理需要按 Accept-Encoding 分桶，无论本次是否真的压缩都要声明
	h.Set("Vary", addVary(h.Get("Vary"), "Accept-Encoding"))

	if code != http.StatusOK || h.Get("Content-Encoding") != "" || tooSmall(h.Get("Content-Length")) {
		w.ResponseWriter.WriteHeader(code)
		return
	}

	// 压缩后长度未知：删掉 Content-Length，由 net/http 改为分块传输
	h.Del("Content-Length")
	h.Set("Content-Encoding", "gzip")
	w.ResponseWriter.WriteHeader(code)
	w.gz = gzipPool.Get().(*gzip.Writer)
	w.gz.Reset(w.ResponseWriter)
}

func (w *compressWriter) Write(p []byte) (int, error) {
	if !w.wroteHeader {
		w.WriteHeader(http.StatusOK)
	}
	if w.gz == nil {
		return w.ResponseWriter.Write(p)
	}
	return w.gz.Write(p)
}

// ReadFrom 让文件服务走大块拷贝；未压缩时交还给底层（保留 sendfile 的机会）。
func (w *compressWriter) ReadFrom(src io.Reader) (int64, error) {
	if !w.wroteHeader {
		w.WriteHeader(http.StatusOK)
	}
	if w.gz == nil {
		if rf, ok := w.ResponseWriter.(io.ReaderFrom); ok {
			return rf.ReadFrom(src)
		}
		return io.Copy(w.ResponseWriter, src)
	}
	return io.Copy(w.gz, src)
}

// Flush 支持流式响应（压缩器先冲刷，再冲刷底层连接）。
func (w *compressWriter) Flush() {
	if w.gz != nil {
		_ = w.gz.Flush()
	}
	if f, ok := w.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

// Unwrap 支持 http.ResponseController（写超时/推流等）。
func (w *compressWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }

func (w *compressWriter) close() {
	if w.gz == nil {
		return
	}
	_ = w.gz.Close() // 写入 gzip 尾部
	gzipPool.Put(w.gz)
	w.gz = nil
}

// acceptsGzip 解析 Accept-Encoding，识别 gzip 与 q=0 的显式拒绝。
func acceptsGzip(r *http.Request) bool {
	for _, part := range strings.Split(r.Header.Get("Accept-Encoding"), ",") {
		name, params, _ := strings.Cut(strings.TrimSpace(part), ";")
		if !strings.EqualFold(strings.TrimSpace(name), "gzip") {
			continue
		}
		for _, p := range strings.Split(params, ";") {
			p = strings.TrimSpace(p)
			if strings.HasPrefix(p, "q=") && strings.TrimSpace(p[2:]) == "0" {
				return false
			}
		}
		return true
	}
	return false
}

// compressibleType 只压文本类媒体类型；png/jpeg/webp/mp4/woff2 已压缩，压了反而更大。
func compressibleType(contentType string) bool {
	mt, _, _ := strings.Cut(contentType, ";")
	mt = strings.ToLower(strings.TrimSpace(mt))
	switch {
	case strings.HasPrefix(mt, "text/"):
		return true
	case mt == "application/json", mt == "application/javascript", mt == "application/x-javascript",
		mt == "application/xml", mt == "application/xhtml+xml", mt == "application/rss+xml",
		mt == "application/manifest+json", mt == "application/ld+json",
		mt == "image/svg+xml", mt == "font/ttf", mt == "font/otf":
		return true
	case strings.HasSuffix(mt, "+json"), strings.HasSuffix(mt, "+xml"):
		return true
	}
	return false
}

// tooSmall Content-Length 已知且小于阈值时不压缩。
func tooSmall(contentLength string) bool {
	if contentLength == "" {
		return false
	}
	n, err := strconv.Atoi(contentLength)
	return err == nil && n < minCompressSize
}

// addVary 追加 Vary 值，避免重复。
func addVary(existing, value string) string {
	if existing == "" {
		return value
	}
	for _, v := range strings.Split(existing, ",") {
		if strings.EqualFold(strings.TrimSpace(v), value) {
			return existing
		}
	}
	return existing + ", " + value
}
