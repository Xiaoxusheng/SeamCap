package service

import "testing"

// 联表查询返回的内嵌媒体对象必须带真实 id（此前固定为 0）。
func TestJoinedMediaIDs(t *testing.T) {
	env := newSvcEnv(t)
	m, err := env.Media.Upload("cover.png", pngReader(t, 8, 8), "cover")
	if err != nil {
		t.Fatal(err)
	}

	// 产品：管理详情 / 公开详情 / 公开列表
	p, err := env.Prods.Create(ProductInput{Name: "Joined Cap", Status: "published", MainImageID: &m.ID})
	if err != nil {
		t.Fatal(err)
	}
	gotP, err := env.Prods.GetAdminByID(p.ID)
	if err != nil {
		t.Fatal(err)
	}
	if gotP.MainImage == nil || gotP.MainImage.ID != m.ID {
		t.Fatalf("product main_image.id = %+v, want %d", gotP.MainImage, m.ID)
	}
	pubP, err := env.Prods.GetPublicBySlug(gotP.Slug)
	if err != nil {
		t.Fatal(err)
	}
	if pubP.MainImage == nil || pubP.MainImage.ID != m.ID {
		t.Errorf("public product main_image.id = %+v, want %d", pubP.MainImage, m.ID)
	}
	listP, _, err := env.Prods.ListPublic(ProductListParams{Page: 1, PerPage: 10})
	if err != nil {
		t.Fatal(err)
	}
	if len(listP) != 1 || listP[0].MainImage == nil || listP[0].MainImage.ID != m.ID {
		t.Errorf("product list main_image id wrong: %+v", listP)
	}

	// 分类：管理详情 / 列表
	c, err := env.Cats.Create(CategoryInput{Name: "Caps", Status: "active", ImageID: &m.ID})
	if err != nil {
		t.Fatal(err)
	}
	gotC, err := env.Cats.GetAdminByID(c.ID)
	if err != nil {
		t.Fatal(err)
	}
	if gotC.Image == nil || gotC.Image.ID != m.ID {
		t.Errorf("category image.id = %+v, want %d", gotC.Image, m.ID)
	}
	cats, err := env.Cats.ListAdmin()
	if err != nil {
		t.Fatal(err)
	}
	if len(cats) != 1 || cats[0].Image == nil || cats[0].Image.ID != m.ID {
		t.Errorf("category list image id wrong: %+v", cats)
	}

	// 工艺：管理详情 / 公开详情 / 公开列表
	k, err := env.Crafts.Create(CraftInput{Title: "Craft", Status: "published", CoverImageID: &m.ID})
	if err != nil {
		t.Fatal(err)
	}
	gotK, err := env.Crafts.GetAdminByID(k.ID)
	if err != nil {
		t.Fatal(err)
	}
	if gotK.CoverImage == nil || gotK.CoverImage.ID != m.ID {
		t.Errorf("craft cover_image.id = %+v, want %d", gotK.CoverImage, m.ID)
	}
	pubK, err := env.Crafts.GetPublicBySlug(gotK.Slug)
	if err != nil {
		t.Fatal(err)
	}
	if pubK.CoverImage == nil || pubK.CoverImage.ID != m.ID {
		t.Errorf("public craft cover_image.id = %+v, want %d", pubK.CoverImage, m.ID)
	}
	crafts, err := env.Crafts.ListPublic()
	if err != nil {
		t.Fatal(err)
	}
	if len(crafts) != 1 || crafts[0].CoverImage == nil || crafts[0].CoverImage.ID != m.ID {
		t.Errorf("craft list cover_image id wrong: %+v", crafts)
	}

	// 首页：管理 / 公开
	if _, err := env.Home.Update(HomeInput{HeroImageID: &m.ID}); err != nil {
		t.Fatal(err)
	}
	h, err := env.Home.GetAdmin()
	if err != nil {
		t.Fatal(err)
	}
	if h.HeroImage == nil || h.HeroImage.ID != m.ID {
		t.Errorf("home hero_image.id = %+v, want %d", h.HeroImage, m.ID)
	}
	hp, err := env.Home.GetPublic()
	if err != nil {
		t.Fatal(err)
	}
	if hp.Hero.HeroImage == nil || hp.Hero.HeroImage.ID != m.ID {
		t.Errorf("public home hero_image.id = %+v, want %d", hp.Hero.HeroImage, m.ID)
	}
}
