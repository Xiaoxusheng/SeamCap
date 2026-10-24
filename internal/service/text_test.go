package service

import (
	"strings"
	"testing"
	"unicode/utf8"
)

// 校验按字符计数：中文/emoji 不应因 UTF-8 多字节而被提前拒绝或截断。
func TestValidationCountsRunes(t *testing.T) {
	env := newSvcEnv(t)

	name200 := strings.Repeat("无", 200)
	if _, err := env.Prods.Create(ProductInput{Name: name200, Status: "draft"}); err != nil {
		t.Errorf("200 Chinese chars should pass: %v", err)
	}
	if _, err := env.Prods.Create(ProductInput{Name: name200 + "无", Status: "draft"}); err == nil {
		t.Error("201 Chinese chars should fail")
	}

	if _, err := env.Cats.Create(CategoryInput{Name: name200, NameEn: "solid", Status: "active"}); err != nil {
		t.Errorf("200-char category name should pass: %v", err)
	}

	if _, err := env.Home.Update(HomeInput{HeroTitle: strings.Repeat("帽", 201)}); err == nil {
		t.Error("201-char hero title should fail")
	}

	// 媒体 alt 500 字符完整保留
	alt := strings.Repeat("图", 500)
	m, err := env.Media.Upload("图.png", pngReader(t, 8, 8), alt)
	if err != nil {
		t.Fatal(err)
	}
	if m.AltText != alt {
		t.Errorf("alt text should keep all 500 runes, got %d", charCount(m.AltText))
	}

	// 超长 alt 与超长文件名按字符截断，且是合法 UTF-8
	m2, err := env.Media.Upload(strings.Repeat("帽", 300)+".png", pngReader(t, 12, 12), strings.Repeat("图", 501))
	if err != nil {
		t.Fatal(err)
	}
	if charCount(m2.AltText) != 500 {
		t.Errorf("alt should be truncated to 500 runes, got %d", charCount(m2.AltText))
	}
	if charCount(m2.OriginalName) != 255 || !utf8.ValidString(m2.OriginalName) {
		t.Errorf("original name should be 255 valid runes, got %d valid=%v", charCount(m2.OriginalName), utf8.ValidString(m2.OriginalName))
	}
}
