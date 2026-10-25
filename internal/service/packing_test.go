package service

import (
	"testing"

	"seamcap/internal/apperr"
	"seamcap/internal/model"
)

// mkPackingMedia 建一条媒体记录（测试用，不落真实文件）。
func mkPackingMedia(t *testing.T, env *svcEnv, name, mime string) int64 {
	t.Helper()
	id, err := env.Repos.Media.Create(&model.Media{
		Filename:     "2026/10/" + name,
		OriginalName: name,
		MimeType:     mime,
		SizeBytes:    1024,
		SHA256:       name,
	})
	if err != nil {
		t.Fatalf("create media: %v", err)
	}
	return id
}

func TestPackingCreateDefaultsAndVisibility(t *testing.T) {
	env := newSvcEnv(t)
	img := mkPackingMedia(t, env, "packing-a.jpg", "image/jpeg")
	img2 := mkPackingMedia(t, env, "packing-b.jpg", "image/jpeg")

	pub, err := env.Packing.Create(PackingInput{MediaID: img, Title: "Cartons"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if pub.Category != PackingCategoryPacking {
		t.Errorf("default category = %q, want packing", pub.Category)
	}
	if pub.Status != "published" {
		t.Errorf("default status = %q, want published", pub.Status)
	}
	if pub.Media == nil || pub.Media.URL == "" {
		t.Errorf("media not joined: %+v", pub.Media)
	}

	// 第二条排序靠后、且一条隐藏
	second, err := env.Packing.Create(PackingInput{MediaID: img2, Category: PackingCategoryLoading, SortOrder: 5})
	if err != nil {
		t.Fatalf("create second: %v", err)
	}
	hidden, err := env.Packing.Create(PackingInput{MediaID: img, Status: "hidden", SortOrder: 1})
	if err != nil {
		t.Fatalf("create hidden: %v", err)
	}

	list, err := env.Packing.ListPublic()
	if err != nil {
		t.Fatalf("list public: %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("public list = %d items, want 2 (hidden excluded)", len(list))
	}
	if list[0].ID != pub.ID || list[1].ID != second.ID {
		t.Errorf("order wrong: %d,%d", list[0].ID, list[1].ID)
	}

	all, err := env.Packing.ListAdmin()
	if err != nil {
		t.Fatalf("list admin: %v", err)
	}
	if len(all) != 3 {
		t.Fatalf("admin list = %d, want 3", len(all))
	}
	_ = hidden
}

func TestPackingValidation(t *testing.T) {
	env := newSvcEnv(t)
	img := mkPackingMedia(t, env, "packing-c.jpg", "image/png")
	doc := mkPackingMedia(t, env, "packing-spec.pdf", "application/pdf")

	cases := []struct {
		name  string
		in    PackingInput
		field string
	}{
		{"missing media", PackingInput{Category: "packing"}, "media_id"},
		{"unknown media", PackingInput{MediaID: 999999}, "media_id"},
		{"wrong mime", PackingInput{MediaID: doc}, "media_id"},
		{"bad category", PackingInput{MediaID: img, Category: "shipping"}, "category"},
		{"bad status", PackingInput{MediaID: img, Status: "archived"}, "status"},
	}
	for _, c := range cases {
		_, err := env.Packing.Create(c.in)
		ae, ok := apperr.As(err)
		if !ok || ae.Code != apperr.CodeValidation {
			t.Fatalf("%s: want invalid, got %v", c.name, err)
		}
		if _, exists := ae.Fields[c.field]; !exists {
			t.Errorf("%s: missing field %q in %v", c.name, c.field, ae.Fields)
		}
	}
}

func TestPackingUpdateDelete(t *testing.T) {
	env := newSvcEnv(t)
	img := mkPackingMedia(t, env, "packing-d.jpg", "image/jpeg")
	video := mkPackingMedia(t, env, "packing-d.mp4", "video/mp4")

	it, err := env.Packing.Create(PackingInput{MediaID: img, Title: "Cartons"})
	if err != nil {
		t.Fatal(err)
	}
	upd, err := env.Packing.Update(it.ID, PackingInput{
		MediaID: video, Category: PackingCategoryLoading, Title: "Loading", Caption: "Dock", Status: "published",
	})
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if upd.MediaID != video || upd.Category != PackingCategoryLoading || upd.Title != "Loading" {
		t.Errorf("update not applied: %+v", upd)
	}
	if upd.Media == nil || upd.Media.MimeType != "video/mp4" {
		t.Errorf("media not re-joined: %+v", upd.Media)
	}

	if _, err := env.Packing.Update(it.ID, PackingInput{MediaID: img, Title: "", Status: "hidden", SortOrder: 9}); err != nil {
		t.Fatalf("update hidden: %v", err)
	}
	if pub, _ := env.Packing.ListPublic(); len(pub) != 0 {
		t.Errorf("hidden item still public: %d", len(pub))
	}

	if err := env.Packing.Delete(it.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, err := env.Packing.GetAdminByID(it.ID); err == nil {
		t.Errorf("deleted item still readable")
	}
	if err := env.Packing.Delete(it.ID); err == nil {
		t.Errorf("deleting twice should 404")
	}
}

func TestPackingNextSort(t *testing.T) {
	env := newSvcEnv(t)
	img := mkPackingMedia(t, env, "packing-e.jpg", "image/jpeg")
	if n, err := env.Packing.NextSort(); err != nil || n != 1 {
		t.Fatalf("empty next sort = %d, %v; want 1", n, err)
	}
	if _, err := env.Packing.Create(PackingInput{MediaID: img, SortOrder: 7}); err != nil {
		t.Fatal(err)
	}
	if n, err := env.Packing.NextSort(); err != nil || n != 8 {
		t.Fatalf("next sort = %d, %v; want 8", n, err)
	}
}
