package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"seamcap/internal/apperr"
)

func TestClientIP(t *testing.T) {
	if err := SetTrustedProxies([]string{"127.0.0.0/8", "::1/128", "10.0.0.0/8"}); err != nil {
		t.Fatal(err)
	}
	cases := []struct {
		name       string
		remoteAddr string
		xff        string
		xri        string
		want       string
	}{
		{"direct client, XFF ignored", "8.8.8.8:1234", "1.1.1.1", "", "8.8.8.8"},
		{"trusted proxy appends real client", "127.0.0.1:1234", "203.0.113.9, 198.51.100.7", "", "198.51.100.7"},
		{"spoofed left entry ignored", "127.0.0.1:1234", "1.2.3.4, 8.8.8.8", "", "8.8.8.8"},
		{"skip trusted hops", "127.0.0.1:1234", "203.0.113.9, 10.0.0.5", "", "203.0.113.9"},
		{"only trusted hops -> X-Real-IP", "127.0.0.1:1234", "10.0.0.5", "203.0.113.5", "203.0.113.5"},
		{"only trusted hops -> remote", "127.0.0.1:1234", "10.0.0.5", "", "127.0.0.1"},
		{"invalid XFF entries skipped", "127.0.0.1:1234", "garbage, 8.8.8.8", "", "8.8.8.8"},
		{"ipv6 loopback trusted", "[::1]:1234", "1.2.3.4, 2001:db8::1", "", "2001:db8::1"},
		{"no forwarded headers", "192.0.2.10:5555", "", "", "192.0.2.10"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			r := httptest.NewRequest("POST", "http://example.com/api/v1/inquiries", nil)
			r.RemoteAddr = c.remoteAddr
			if c.xff != "" {
				r.Header.Set("X-Forwarded-For", c.xff)
			}
			if c.xri != "" {
				r.Header.Set("X-Real-IP", c.xri)
			}
			if got := ClientIP(r); got != c.want {
				t.Errorf("ClientIP = %q, want %q", got, c.want)
			}
		})
	}
}

func TestNoStore(t *testing.T) {
	h := NoStore(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	if got := rec.Header().Get("Cache-Control"); got != "no-store" {
		t.Errorf("Cache-Control = %q, want no-store", got)
	}
}

func TestWriteAuthErrorEscapesJSON(t *testing.T) {
	rec := httptest.NewRecorder()
	writeAuthError(rec, apperr.Unauthorized(`quote " and backslash \ must stay valid JSON`))
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rec.Code)
	}
	var body struct {
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("response is not valid JSON: %v (%s)", err, rec.Body.String())
	}
	if body.Error.Code != apperr.CodeUnauthorized || body.Error.Message == "" {
		t.Errorf("unexpected body: %+v", body)
	}
}

func TestSameOrigin(t *testing.T) {
	cases := []struct {
		name   string
		origin string
		ref    string
		want   bool
	}{
		{"exact origin", "https://example.com", "", true},
		{"origin with port", "http://example.com:8080", "", false},
		{"host suffix attack", "https://example.com.evil.com", "", false},
		{"host in query attack", "https://evil.com/?u=http://example.com", "", false},
		{"userinfo attack", "https://example.com@evil.com", "", false},
		{"null origin", "null", "", false},
		{"referer allowed", "", "https://example.com/products/x", true},
		{"referer other host", "", "https://evil.com/products/x", false},
		{"missing both", "", "", true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			r := httptest.NewRequest("POST", "http://example.com/api/v1/inquiries", nil)
			if c.origin != "" {
				r.Header.Set("Origin", c.origin)
			}
			if c.ref != "" {
				r.Header.Set("Referer", c.ref)
			}
			if got := SameOrigin(r); got != c.want {
				t.Errorf("SameOrigin = %v, want %v", got, c.want)
			}
		})
	}
}
