package service

import (
	"testing"

	"seamcap/internal/testutil"
)

// svcEnv service 层测试环境（在 testutil 仓库环境上装配全部服务）。
type svcEnv struct {
	*testutil.Env

	Auth     *AuthService
	Prods    *ProductService
	Cats     *CategoryService
	Media    *MediaService
	Crafts   *CraftService
	Packing  *PackingService
	Pages    *PageService
	Home     *HomeService
	Settings *SettingsService
	Inqs     *InquiryService
	Dash     *DashboardService
}

func newSvcEnv(t *testing.T) *svcEnv {
	t.Helper()
	e := testutil.NewEnv(t)
	s := &svcEnv{Env: e}
	s.Auth = NewAuthService(e.Cfg, e.Repos.Admin, e.Repos.Audit, e.Secret)
	s.Prods = NewProductService(e.Repos.Prod, e.Repos.Cat, e.Repos.Media)
	s.Cats = NewCategoryService(e.Repos.Cat, e.Repos.Prod, e.Repos.Media)
	s.Media = NewMediaService(e.Repos.Media, e.Store, e.Cfg.MaxImageMB, e.Cfg.MaxVideoMB)
	s.Crafts = NewCraftService(e.Repos.Craft, e.Repos.Media)
	s.Packing = NewPackingService(e.Repos.Packing, e.Repos.Media)
	s.Pages = NewPageService(e.Repos.Page)
	s.Home = NewHomeService(e.Repos.Home, e.Repos.Media, e.Repos.Prod, e.Repos.Craft)
	s.Settings = NewSettingsService(e.Repos.Settings)
	s.Inqs = NewInquiryService(e.Repos.Inq, e.Repos.Prod, e.Mail, e.Cfg.RateLimitInquiryPerHour)
	s.Inqs.MinInterval = 0 // 测试不等待
	s.Dash = NewDashboardService(e.Repos.Prod, e.Repos.Craft, e.Repos.Inq)
	return s
}

// CreateAdmin 直接创建管理员（绕过初始引导）。
func (s *svcEnv) CreateAdmin(t *testing.T, username, password string) *svcEnv {
	t.Helper()
	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	if _, err := s.Repos.Admin.CreateAdmin(username, hash); err != nil {
		t.Fatalf("create admin: %v", err)
	}
	return s
}
