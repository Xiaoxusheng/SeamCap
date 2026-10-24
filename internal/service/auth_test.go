package service

import (
	"testing"
	"time"
)

func TestHashAndVerifyPassword(t *testing.T) {
	hash, err := HashPassword("correct-horse-1")
	if err != nil {
		t.Fatal(err)
	}
	if !VerifyPassword(hash, "correct-horse-1") {
		t.Error("correct password should verify")
	}
	if VerifyPassword(hash, "wrong-password") {
		t.Error("wrong password should not verify")
	}
	// 编码格式
	if hash[:10] != "$argon2id$" {
		t.Errorf("bad encoding prefix: %q", hash[:10])
	}
	// 恒定参数 m=65536 t=1 p=4
	want := "$argon2id$v=19$m=65536,t=1,p=4$"
	if len(hash) < len(want) || hash[:len(want)] != want {
		t.Errorf("params mismatch: %q", hash)
	}
}

func TestLoginAndSession(t *testing.T) {
	env := newSvcEnv(t).CreateAdmin(t, "admin", "password1234")

	// 正确登录
	res, err := env.Auth.Login("admin", "password1234", "1.2.3.4", "ua", false)
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	if res.Token == "" || res.CSRFToken == "" {
		t.Fatal("token/csrf must not be empty")
	}
	admin, sess, err := env.Auth.Validate(res.Token)
	if err != nil || admin == nil || sess == nil {
		t.Fatalf("validate: %v", err)
	}
	if admin.Username != "admin" {
		t.Errorf("username = %q", admin.Username)
	}

	// 错误密码
	if _, err := env.Auth.Login("admin", "wrong-pass-123", "1.2.3.4", "ua", false); err == nil {
		t.Error("wrong password should fail")
	}
	// 不存在的用户（不暴露存在性）
	if _, err := env.Auth.Login("ghost", "password1234", "1.2.3.4", "ua", false); err == nil {
		t.Error("missing user should fail")
	}
	// 注销后失效
	if err := env.Auth.Logout(res.Token, "1.2.3.4"); err != nil {
		t.Fatalf("logout: %v", err)
	}
	if _, _, err := env.Auth.Validate(res.Token); err == nil {
		t.Error("token should be invalid after logout")
	}
}

func TestLoginRateLimit(t *testing.T) {
	env := newSvcEnv(t).CreateAdmin(t, "admin", "password1234")
	var limited bool
	for i := 0; i < 6; i++ {
		_, err := env.Auth.Login("admin", "bad-password-x", "9.9.9.9", "ua", false)
		if err != nil && err.Error() != "" && contains(err.Error(), "Too many login attempts") {
			limited = true
			break
		}
	}
	if !limited {
		t.Error("6th login attempt from same IP should be rate limited")
	}
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}

func TestChangePassword(t *testing.T) {
	env := newSvcEnv(t).CreateAdmin(t, "admin", "password1234")
	res, _ := env.Auth.Login("admin", "password1234", "1.2.3.4", "ua", false)
	admin, _, _ := env.Auth.Validate(res.Token)

	// 当前密码错误
	if err := env.Auth.ChangePassword(admin, res.Token, "wrong-current-1", "newpassword99"); err == nil {
		t.Error("wrong current password should fail")
	}
	// 弱密码
	if err := env.Auth.ChangePassword(admin, res.Token, "password1234", "short1"); err == nil {
		t.Error("weak password should fail")
	}
	if err := env.Auth.ChangePassword(admin, res.Token, "password1234", "onlylettersxxxx"); err == nil {
		t.Error("password without digits should fail")
	}
	// 正确修改
	if err := env.Auth.ChangePassword(admin, res.Token, "password1234", "newpassword99"); err != nil {
		t.Fatalf("change password: %v", err)
	}
	if _, _, err := env.Auth.Validate(res.Token); err != nil {
		t.Error("current session should remain valid")
	}
	if _, err := env.Auth.Login("admin", "newpassword99", "5.5.5.5", "ua", false); err != nil {
		t.Errorf("new password should work: %v", err)
	}
}

func TestCSRFBinding(t *testing.T) {
	env := newSvcEnv(t).CreateAdmin(t, "admin", "password1234")
	res, _ := env.Auth.Login("admin", "password1234", "1.2.3.4", "ua", false)
	if !env.Auth.CheckCSRF(res.Token, res.CSRFToken) {
		t.Error("csrf should match its session token")
	}
	if env.Auth.CheckCSRF(res.Token, "deadbeef") {
		t.Error("wrong csrf should fail")
	}
	res2, _ := env.Auth.Login("admin", "password1234", "6.6.6.6", "ua", false)
	if env.Auth.CheckCSRF(res2.Token, res.CSRFToken) {
		t.Error("csrf must be bound to its own session")
	}
}

func TestRememberLoginTTL(t *testing.T) {
	env := newSvcEnv(t).CreateAdmin(t, "admin", "password1234")

	res, err := env.Auth.Login("admin", "password1234", "1.2.3.4", "ua", true)
	if err != nil {
		t.Fatal(err)
	}
	if res.TTL != env.Cfg.RememberTTL {
		t.Errorf("remember TTL = %v, want %v", res.TTL, env.Cfg.RememberTTL)
	}
	sess, err := env.Repos.Admin.GetSession(tokenHash(res.Token))
	if err != nil || sess == nil {
		t.Fatalf("session: %v %v", sess, err)
	}
	if !sess.Remember {
		t.Error("session should be marked remember")
	}
	exp, err := time.Parse(time.RFC3339, sess.ExpiresAt)
	if err != nil {
		t.Fatal(err)
	}
	if d := time.Until(exp); d < env.Cfg.RememberTTL-time.Hour {
		t.Errorf("remember expiry = %v, want ~%v", d, env.Cfg.RememberTTL)
	}

	// 不勾选仍是短会话
	short, err := env.Auth.Login("admin", "password1234", "9.9.9.9", "ua", false)
	if err != nil {
		t.Fatal(err)
	}
	if short.TTL != env.Cfg.SessionTTL {
		t.Errorf("normal TTL = %v, want %v", short.TTL, env.Cfg.SessionTTL)
	}

	// 记住会话的滑动续期使用 30 天 TTL，而不是退回 7 天
	near := time.Now().UTC().Add(time.Hour).Format(time.RFC3339)
	if err := env.Repos.Admin.ExtendSession(sess.ID, near); err != nil {
		t.Fatal(err)
	}
	if _, _, err := env.Auth.Validate(res.Token); err != nil {
		t.Fatalf("validate: %v", err)
	}
	got, err := env.Repos.Admin.GetSession(tokenHash(res.Token))
	if err != nil || got == nil {
		t.Fatalf("session after renew: %v %v", got, err)
	}
	exp, err = time.Parse(time.RFC3339, got.ExpiresAt)
	if err != nil {
		t.Fatal(err)
	}
	if d := time.Until(exp); d < env.Cfg.RememberTTL-time.Hour {
		t.Errorf("renewed expiry = %v, want ~%v", d, env.Cfg.RememberTTL)
	}
}
