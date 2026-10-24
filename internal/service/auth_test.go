package service

import (
	"testing"
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
	res, err := env.Auth.Login("admin", "password1234", "1.2.3.4", "ua")
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
	if _, err := env.Auth.Login("admin", "wrong-pass-123", "1.2.3.4", "ua"); err == nil {
		t.Error("wrong password should fail")
	}
	// 不存在的用户（不暴露存在性）
	if _, err := env.Auth.Login("ghost", "password1234", "1.2.3.4", "ua"); err == nil {
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
		_, err := env.Auth.Login("admin", "bad-password-x", "9.9.9.9", "ua")
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
	res, _ := env.Auth.Login("admin", "password1234", "1.2.3.4", "ua")
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
	if _, err := env.Auth.Login("admin", "newpassword99", "5.5.5.5", "ua"); err != nil {
		t.Errorf("new password should work: %v", err)
	}
}

func TestCSRFBinding(t *testing.T) {
	env := newSvcEnv(t).CreateAdmin(t, "admin", "password1234")
	res, _ := env.Auth.Login("admin", "password1234", "1.2.3.4", "ua")
	if !env.Auth.CheckCSRF(res.Token, res.CSRFToken) {
		t.Error("csrf should match its session token")
	}
	if env.Auth.CheckCSRF(res.Token, "deadbeef") {
		t.Error("wrong csrf should fail")
	}
	res2, _ := env.Auth.Login("admin", "password1234", "6.6.6.6", "ua")
	if env.Auth.CheckCSRF(res2.Token, res.CSRFToken) {
		t.Error("csrf must be bound to its own session")
	}
}
