// Package middleware HTTP 中间件：请求日志、recovery、安全头、认证、请求体限制。
package middleware

import (
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"runtime/debug"
	"strings"
	"sync"
	"time"
)

// statusRecorder 记录状态码与字节数。
type statusRecorder struct {
	http.ResponseWriter
	status int
	bytes  int64
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func (r *statusRecorder) Write(b []byte) (int, error) {
	if r.status == 0 {
		r.status = 200
	}
	n, err := r.ResponseWriter.Write(b)
	r.bytes += int64(n)
	return n, err
}

// Unwrap 支持 http.ResponseController。
func (r *statusRecorder) Unwrap() http.ResponseWriter { return r.ResponseWriter }

// RequestLogger 结构化请求日志（JSON 到 stdout；不含敏感字段）。
func RequestLogger(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			rec := &statusRecorder{ResponseWriter: w}
			next.ServeHTTP(rec, r)
			if rec.status == 0 {
				rec.status = 200
			}
			// /uploads 与静态资源降噪：仅 4xx/5xx 记 info，其余跳过
			logger.LogAttrs(r.Context(), slog.LevelInfo, "http_request",
				slog.String("method", r.Method),
				slog.String("path", r.URL.Path),
				slog.Int("status", rec.status),
				slog.Int64("bytes", rec.bytes),
				slog.String("ip", ClientIP(r)),
				slog.Duration("duration", time.Since(start)),
			)
		})
	}
}

// Recoverer panic 恢复：500 + 统一错误结构（不暴露堆栈给客户端）。
func Recoverer(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					logger.Error("panic recovered",
						"error", rec,
						"path", r.URL.Path,
						"stack", string(debug.Stack()),
					)
					w.Header().Set("Content-Type", "application/json; charset=utf-8")
					w.WriteHeader(http.StatusInternalServerError)
					_, _ = w.Write([]byte(`{"error":{"code":"INTERNAL","message":"Internal server error"}}`))
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

// SecureHeaders 全局安全头。
func SecureHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		next.ServeHTTP(w, r)
	})
}

// AdminSecurityHeaders 管理端附加安全头：X-Frame-Options: DENY + noindex。
func AdminSecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Frame-Options", "DENY")
		h.Set("X-Robots-Tag", "noindex")
		h.Set("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'")
		next.ServeHTTP(w, r)
	})
}

// MaxBody 限制请求体大小。
func MaxBody(n int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Body != nil {
				r.Body = http.MaxBytesReader(w, r.Body, n)
			}
			next.ServeHTTP(w, r)
		})
	}
}

// NoStore 禁止缓存响应（管理端响应含会话/PII 数据，避免留在浏览器或中间缓存）。
func NoStore(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}

// 默认受信代理网段：回环 + RFC1918/ULA。仅这些地址发来的 X-Forwarded-For 才会被信任。
var defaultTrustedProxies = []string{
	"127.0.0.0/8", "::1/128",
	"10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "fc00::/7",
}

var (
	trustedMu   sync.RWMutex
	trustedNets []*net.IPNet
)

func init() { _ = SetTrustedProxies(nil) }

// SetTrustedProxies 设置受信反代网段（支持 CIDR 或裸 IP）；空列表恢复默认值。
func SetTrustedProxies(cidrs []string) error {
	if len(cidrs) == 0 {
		cidrs = defaultTrustedProxies
	}
	nets := make([]*net.IPNet, 0, len(cidrs))
	for _, raw := range cidrs {
		c := strings.TrimSpace(raw)
		if c == "" {
			continue
		}
		if !strings.Contains(c, "/") {
			ip := net.ParseIP(c)
			if ip == nil {
				return fmt.Errorf("invalid trusted proxy %q", raw)
			}
			bits := 32
			if ip.To4() == nil {
				bits = 128
			}
			c = fmt.Sprintf("%s/%d", ip.String(), bits)
		}
		_, ipnet, err := net.ParseCIDR(c)
		if err != nil {
			return fmt.Errorf("invalid trusted proxy %q: %w", raw, err)
		}
		nets = append(nets, ipnet)
	}
	trustedMu.Lock()
	trustedNets = nets
	trustedMu.Unlock()
	return nil
}

func isTrustedProxyIP(ip net.IP) bool {
	if ip == nil {
		return false
	}
	trustedMu.RLock()
	defer trustedMu.RUnlock()
	for _, n := range trustedNets {
		if n.Contains(ip) {
			return true
		}
	}
	return false
}

func remoteHost(remoteAddr string) string {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		host = remoteAddr
	}
	return strings.Trim(host, "[]")
}

// ClientIP 提取客户端 IP：仅当直连方是受信代理时解析转发头，
// 并从右向左取第一个非受信地址（最右侧由最近一跳代理写入，客户端无法伪造）。
func ClientIP(r *http.Request) string {
	remote := remoteHost(r.RemoteAddr)
	if !isTrustedProxyIP(net.ParseIP(remote)) {
		return remote
	}
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		const maxHops = 20 // 防超长头放大
		if len(parts) > maxHops {
			parts = parts[len(parts)-maxHops:]
		}
		for i := len(parts) - 1; i >= 0; i-- {
			cand := strings.TrimSpace(parts[i])
			ip := net.ParseIP(cand)
			if ip == nil {
				continue
			}
			if !isTrustedProxyIP(ip) {
				return cand
			}
		}
	}
	if xr := strings.TrimSpace(r.Header.Get("X-Real-IP")); xr != "" {
		if net.ParseIP(xr) != nil {
			return xr
		}
	}
	return remote
}
