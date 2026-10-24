package service

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"strings"
	"testing"

	"seamcap/internal/apperr"
)

func pngReader(t *testing.T, w, h int) *bytes.Reader {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	img.Set(0, 0, color.RGBA{255, 0, 0, 255})
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return bytes.NewReader(buf.Bytes())
}

func TestProductSlugConflictAndSuggestion(t *testing.T) {
	env := newSvcEnv(t)
	if _, err := env.Prods.Create(ProductInput{Name: "Solid Cap", Slug: "solid-cap", Status: "published"}); err != nil {
		t.Fatal(err)
	}
	_, err := env.Prods.Create(ProductInput{Name: "Another Cap", Slug: "solid-cap", Status: "draft"})
	ae, ok := apperr.As(err)
	if !ok || ae.Code != apperr.CodeConflict {
		t.Fatalf("want 409 conflict, got %v", err)
	}
	if ae.Fields["suggestion"] != "solid-cap-2" {
		t.Errorf("suggestion wrong: %v", ae.Fields)
	}
	// 不传 slug 自动生成且去重
	p2, err := env.Prods.Create(ProductInput{Name: "Solid Cap", Status: "published"})
	if err != nil {
		t.Fatalf("auto slug: %v", err)
	}
	if p2.Slug == "" || p2.Slug == "solid-cap" {
		t.Errorf("auto slug should differ: %q", p2.Slug)
	}
}

func TestProductVisibilityAndPublish(t *testing.T) {
	env := newSvcEnv(t)
	draft, _ := env.Prods.Create(ProductInput{Name: "Draft Cap", Status: "draft"})
	if _, err := env.Prods.GetPublicBySlug(draft.Slug); err == nil {
		t.Error("draft product must not be public")
	}
	// 发布 → 公开可见，published_at 记录
	pub, err := env.Prods.Update(draft.ID, ProductInput{Name: "Draft Cap", Status: "published"})
	if err != nil {
		t.Fatal(err)
	}
	if pub.PublishedAt == nil {
		t.Error("published_at should be set on first publish")
	}
	got, err := env.Prods.GetPublicBySlug(pub.Slug)
	if err != nil || got.ID != pub.ID {
		t.Errorf("published product should be public: %v %v", got, err)
	}
}

func TestProductDuplicate(t *testing.T) {
	env := newSvcEnv(t)
	src, _ := env.Prods.Create(ProductInput{Name: "Orig Cap", Slug: "orig-cap", Status: "published"})
	dst, err := env.Prods.Duplicate(src.ID)
	if err != nil {
		t.Fatal(err)
	}
	if dst.Status != "draft" || dst.Slug != "orig-cap-copy" || dst.PublishedAt != nil {
		t.Errorf("duplicate wrong: slug=%s status=%s", dst.Slug, dst.Status)
	}
	if dst.Name != "Orig Cap (Copy)" {
		t.Errorf("name = %q", dst.Name)
	}
}

func TestProductMediaRoles(t *testing.T) {
	env := newSvcEnv(t)
	p, _ := env.Prods.Create(ProductInput{Name: "Cap", Status: "published"})
	m1, err := env.Media.Upload("a.png", pngReader(t, 4, 4), "alt a")
	if err != nil {
		t.Fatal(err)
	}
	m2, err := env.Media.Upload("b.png", pngReader(t, 5, 5), "alt b")
	if err != nil {
		t.Fatal(err)
	}
	got, err := env.Prods.SetMedia(p.ID, []MediaRefInput{
		{MediaID: m1.ID, Role: "main", SortOrder: 0},
		{MediaID: m2.ID, Role: "gallery", SortOrder: 1},
	})
	if err != nil {
		t.Fatal(err)
	}
	if got.MainImageID == nil || *got.MainImageID != m1.ID {
		t.Errorf("main image not synced: %v", got.MainImageID)
	}
	if len(got.Images) != 2 || got.Images[0].Role != "main" {
		t.Errorf("images wrong: %+v", got.Images)
	}
	// 多个 main 拒绝
	_, err = env.Prods.SetMedia(p.ID, []MediaRefInput{
		{MediaID: m1.ID, Role: "main"},
		{MediaID: m2.ID, Role: "main"},
	})
	if !isValidation(err, "items") {
		t.Errorf("two mains should fail: %v", err)
	}
	// 引用中删除媒体 → 409 + 引用来源
	err = env.Media.Delete(m1.ID)
	ae, ok := apperr.As(err)
	if !ok || ae.Code != apperr.CodeConflict {
		t.Fatalf("referenced media delete should 409, got %v", err)
	}
	if ae.Fields["references"] == "" {
		t.Error("references should be listed")
	}
}

func TestMediaDedupBySHA(t *testing.T) {
	env := newSvcEnv(t)
	m1, err := env.Media.Upload("first.png", pngReader(t, 6, 6), "")
	if err != nil {
		t.Fatal(err)
	}
	m2, err := env.Media.Upload("second.png", pngReader(t, 6, 6), "")
	if err != nil {
		t.Fatal(err)
	}
	if m1.ID != m2.ID {
		t.Errorf("same content should dedup to same asset: %d vs %d", m1.ID, m2.ID)
	}
}

func TestMediaOversizeRejected(t *testing.T) {
	env := newSvcEnv(t) // MaxImageMB=1，但用极小 limit 直接构造：改用超大像素图突破 1MB
	big := image.NewRGBA(image.Rect(0, 0, 1200, 1200))
	var buf bytes.Buffer
	if err := png.Encode(&buf, big); err != nil {
		t.Fatal(err)
	}
	// PNG 压缩后可能小于 1MB；用重复噪声确保超限
	noisy := image.NewRGBA(image.Rect(0, 0, 600, 600))
	for x := 0; x < 600; x++ {
		for y := 0; y < 600; y++ {
			noisy.Set(x, y, color.RGBA{uint8(x * y % 255), uint8(x + y), uint8(x ^ y), 255})
		}
	}
	buf.Reset()
	if err := png.Encode(&buf, noisy); err != nil {
		t.Fatal(err)
	}
	if int64(buf.Len()) < 1<<20 {
		t.Skip("test image smaller than 1MB limit; skip oversize case")
	}
	_, err := env.Media.Upload("big.png", bytes.NewReader(buf.Bytes()), "")
	ae, ok := apperr.As(err)
	if !ok || ae.Code != apperr.CodeTooLarge {
		t.Errorf("oversize upload should be 413, got %v", err)
	}
}

func TestCategoryDeleteStrategies(t *testing.T) {
	env := newSvcEnv(t)
	cat, _ := env.Cats.Create(CategoryInput{Name: "Plain", NameEn: "Plain", Status: "active"})
	cat2, _ := env.Cats.Create(CategoryInput{Name: "Camo", NameEn: "Camo", Status: "active"})
	p, _ := env.Prods.Create(ProductInput{Name: "Cap", CategoryID: &cat.ID, Status: "draft"})

	// 有产品 → 409 + 数量
	_, err := env.Cats.Delete(cat.ID, "", 0)
	ae, ok := apperr.As(err)
	if !ok || ae.Code != apperr.CodeConflict || ae.Fields["product_count"] != "1" {
		t.Fatalf("delete non-empty category should 409 with count, got %v", err)
	}
	// reassign → 迁移并删除
	res, err := env.Cats.Delete(cat.ID, "reassign", cat2.ID)
	if err != nil || !res.Deleted || res.Reassigned != 1 {
		t.Fatalf("reassign delete: %v %+v", err, res)
	}
	got, _ := env.Prods.GetAdminByID(p.ID)
	if got.CategoryID == nil || *got.CategoryID != cat2.ID {
		t.Errorf("product should move to target category: %v", got.CategoryID)
	}
	// archive → 停用不删除
	res2, err := env.Cats.Delete(cat2.ID, "archive", 0)
	if err != nil || !res2.Archived {
		t.Fatalf("archive: %v %+v", err, res2)
	}
	c, _ := env.Cats.GetAdminByID(cat2.ID)
	if c == nil || c.Status != "inactive" {
		t.Error("archived category should be inactive and still exist")
	}
}

func TestChineseNameSlugFallback(t *testing.T) {
	env := newSvcEnv(t)

	p, err := env.Prods.Create(ProductInput{Name: "无痕棒球帽", Status: "draft"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(p.Slug, "product-") {
		t.Errorf("product slug = %q, want product- prefix", p.Slug)
	}

	c, err := env.Cats.Create(CategoryInput{Name: "棒球帽", Status: "active"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(c.Slug, "category-") {
		t.Errorf("category slug = %q, want category- prefix", c.Slug)
	}

	k, err := env.Crafts.Create(CraftInput{Title: "无痕工艺", Status: "draft"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(k.Slug, "craft-") {
		t.Errorf("craft slug = %q, want craft- prefix", k.Slug)
	}

	// 显式传入无法转写的 slug → 400
	if _, err := env.Prods.Create(ProductInput{Name: "X", Slug: "中文", Status: "draft"}); !isValidation(err, "slug") {
		t.Errorf("non-ascii explicit slug should fail: %v", err)
	}
	if _, err := env.Cats.Create(CategoryInput{Name: "Y", Slug: "中文", Status: "active"}); !isValidation(err, "slug") {
		t.Errorf("non-ascii category slug should fail: %v", err)
	}

	// 中文名再保存时保留原 slug，不生成新随机值
	upd, err := env.Prods.Update(p.ID, ProductInput{Name: "无痕棒球帽二代", Status: "draft"})
	if err != nil {
		t.Fatal(err)
	}
	if upd.Slug != p.Slug {
		t.Errorf("update changed slug: %q -> %q", p.Slug, upd.Slug)
	}
	updC, err := env.Cats.Update(c.ID, CategoryInput{Name: "棒球帽二代", Status: "active"})
	if err != nil {
		t.Fatal(err)
	}
	if updC.Slug != c.Slug {
		t.Errorf("category update changed slug: %q -> %q", c.Slug, updC.Slug)
	}
	updK, err := env.Crafts.Update(k.ID, CraftInput{Title: "无痕工艺二代", Status: "draft"})
	if err != nil {
		t.Fatal(err)
	}
	if updK.Slug != k.Slug {
		t.Errorf("craft update changed slug: %q -> %q", k.Slug, updK.Slug)
	}
}
