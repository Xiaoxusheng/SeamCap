package service

import (
	"strings"
	"testing"
)

func TestSanitizeHTML(t *testing.T) {
	cases := []struct{ name, in, wantContains, wantNotContains string }{
		{"script removed", `<p>ok</p><script>alert(1)</script>`, "<p>ok</p>", "script"},
		{"style removed", `<style>body{}</style><b>bold</b>`, "<b>bold</b>", "style"},
		{"iframe removed", `<iframe src="x"></iframe>text`, "text", "iframe"},
		{"event attrs removed", `<p onclick="evil()">x</p>`, "<p>x</p>", "onclick"},
		{"js url removed", `<a href="javascript:evil()">x</a>`, "<a>x</a>", "javascript"},
		{"nested script", `<scr<script>ipt>alert(1)</script>`, "", "<script"},
		{"data url removed", `<img src="data:text/html;base64,xx">`, "<img", "data:"},
		{"event attr removed", `<img src=x onerror=alert(1)>`, "<img", "onerror"},
		{"slash separated js url", `<a/href=javascript:alert(1)>x</a>`, "<a>x</a>", "javascript"},
		{"entity encoded js url", `<a href="&#106;avascript:alert(1)">x</a>`, "<a>x</a>", "javascript"},
		{"control char js url", "<a href=\"java\nscript:alert(1)\">x</a>", "<a>x</a>", "script:"},
		{"svg onload removed", `<svg/onload=alert(1)></svg>ok`, "ok", "onload"},
		{"unknown tag unwrapped", `<custom onclick="evil()">text</custom>`, "text", "custom"},
	}
	for _, c := range cases {
		out := SanitizeHTML(c.in)
		if c.wantContains != "" && !strings.Contains(out, c.wantContains) {
			t.Errorf("%s: want contains %q, got %q", c.name, c.wantContains, out)
		}
		if c.wantNotContains != "" && strings.Contains(strings.ToLower(out), strings.ToLower(c.wantNotContains)) {
			t.Errorf("%s: want NOT contains %q, got %q", c.name, c.wantNotContains, out)
		}
	}
	// 正常 HTML 保留
	keep := "<h2>Title</h2><p>Hello <strong>world</strong></p><ul><li>a</li></ul>"
	if out := SanitizeHTML(keep); out != keep {
		t.Errorf("allowed html should be kept: %q", out)
	}
	// 外链强制 noopener
	if out := SanitizeHTML(`<a href="https://example.com" target="_blank">x</a>`); !strings.Contains(out, `rel="noopener noreferrer"`) {
		t.Errorf("target=_blank should get safe rel: %q", out)
	}
}

func TestPageUpsertAndVisibility(t *testing.T) {
	env := newSvcEnv(t)
	p, err := env.Pages.Upsert("about-us", PageInput{Title: "About", Body: "<p>hi</p>", Status: "published"})
	if err != nil {
		t.Fatal(err)
	}
	// 公开可见
	got, err := env.Pages.GetPublic("about-us")
	if err != nil || got.Title != "About" {
		t.Fatalf("public page: %v %v", got, err)
	}
	// 更新（同 slug upsert）
	if _, err := env.Pages.Upsert("about-us", PageInput{Title: "About Us", Body: "<p>updated</p>", Status: "draft"}); err != nil {
		t.Fatal(err)
	}
	if _, err := env.Pages.GetPublic("about-us"); err == nil {
		t.Error("draft page should not be public")
	}
	// 非法 slug
	if _, err := env.Pages.Upsert("Bad Slug!", PageInput{Title: "x", Status: "draft"}); err == nil {
		t.Error("invalid slug should fail")
	}
	_ = p
}

func TestPageSeedDefaults(t *testing.T) {
	env := newSvcEnv(t)
	if err := env.Pages.EnsureDefaults(); err != nil {
		t.Fatal(err)
	}
	// 二次执行不覆盖
	if err := env.Pages.EnsureDefaults(); err != nil {
		t.Fatal(err)
	}
	pages, err := env.Pages.List()
	if err != nil {
		t.Fatal(err)
	}
	if len(pages) != 2 {
		t.Errorf("want 2 seeded pages, got %d", len(pages))
	}
}
