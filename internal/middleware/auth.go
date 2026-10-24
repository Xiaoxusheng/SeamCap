package middleware

import (
	"context"
	"net/http"
	"net/url"
	"strings"

	"seamcap/internal/apperr"
	"seamcap/internal/model"
	"seamcap/internal/service"
)

type ctxKey int

const (
	ctxKeyAdmin ctxKey = iota
	ctxKeySession
	ctxKeyToken
	ctxKeyCSRF
)

// SessionCookieName 管理端会话 Cookie 名。
const SessionCookieName = "seamcap_session"

// AuthRequired 管理接口认证：
// 校验 Cookie → 查 sessions 表（未过期）→ 注入 admin；写操作校验 X-CSRF-Token。
func AuthRequired(auth *service.AuthService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			c, err := r.Cookie(SessionCookieName)
			if err != nil || c.Value == "" {
				writeAuthError(w, apperr.Unauthorized(""))
				return
			}
			admin, sess, verr := auth.Validate(c.Value)
			if verr != nil {
				writeAuthError(w, verr)
				return
			}
			// 写操作（非 GET/HEAD/OPTIONS）要求 CSRF token（登录时下发，绑定会话）
			if r.Method != http.MethodGet && r.Method != http.MethodHead && r.Method != http.MethodOptions {
				if !auth.CheckCSRF(c.Value, r.Header.Get("X-CSRF-Token")) {
					writeAuthError(w, apperr.Forbidden("Missing or invalid X-CSRF-Token"))
					return
				}
			}
			ctx := r.Context()
			ctx = context.WithValue(ctx, ctxKeyAdmin, admin)
			ctx = context.WithValue(ctx, ctxKeySession, sess)
			ctx = context.WithValue(ctx, ctxKeyToken, c.Value)
			ctx = context.WithValue(ctx, ctxKeyCSRF, auth.CSRFToken(c.Value))
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func writeAuthError(w http.ResponseWriter, err error) {
	ae := apperr.Unauthorized("")
	if e, ok := apperr.As(err); ok {
		ae = e
	}
	status := apperr.HTTPStatus(ae.Code)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(`{"error":{"code":"` + ae.Code + `","message":"` + ae.Message + `"}}`))
}

// AdminFromContext 取当前管理员（AuthRequired 之后可用）。
func AdminFromContext(ctx context.Context) *model.AdminUser {
	admin, _ := ctx.Value(ctxKeyAdmin).(*model.AdminUser)
	return admin
}

// TokenFromContext 取当前会话明文 token。
func TokenFromContext(ctx context.Context) string {
	t, _ := ctx.Value(ctxKeyToken).(string)
	return t
}

// CSRFFromContext 取当前会话的 CSRF token。
func CSRFFromContext(ctx context.Context) string {
	t, _ := ctx.Value(ctxKeyCSRF).(string)
	return t
}

// SameOrigin 校验 Origin/Referer 与 Host 同源（公开询价接口 CSRF 防御）。
// Origin 缺失（部分非浏览器客户端）时放行，由 honeypot+限流兜底。
func SameOrigin(r *http.Request) bool {
	raw := r.Header.Get("Origin")
	if raw == "" {
		raw = r.Header.Get("Referer")
	}
	if raw == "" {
		return true
	}
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" {
		return false
	}
	return strings.EqualFold(u.Host, r.Host)
}
