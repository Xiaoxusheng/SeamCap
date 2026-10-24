package service

import (
	"regexp"
	"strings"

	"seamcap/internal/apperr"
	"seamcap/internal/model"
	"seamcap/internal/repository"
)

// PageService 普通页面业务逻辑。
type PageService struct{ repo *repository.PageRepo }

func NewPageService(repo *repository.PageRepo) *PageService { return &PageService{repo} }

// Repo 供 handler/SEO 层读取底层仓库（sitemap 等）。
func (s *PageService) Repo() *repository.PageRepo { return s.repo }

// PageInput 页面入参。
type PageInput struct {
	Title    string `json:"title"`
	Body     string `json:"body"`
	Status   string `json:"status"`
	SEOTitle string `json:"seo_title"`
	SEODesc  string `json:"seo_desc"`
}

// GetPublic 公开页面（仅 published）。
func (s *PageService) GetPublic(slug string) (*model.Page, error) {
	p, err := s.repo.GetPublicBySlug(slug)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	if p == nil {
		return nil, apperr.NotFound("Page not found")
	}
	return p, nil
}

// List 管理列表。
func (s *PageService) List() ([]model.Page, error) {
	items, err := s.repo.List()
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	return items, nil
}

// Get 管理详情。
func (s *PageService) Get(slug string) (*model.Page, error) {
	p, err := s.repo.GetBySlug(slug)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	if p == nil {
		return nil, apperr.NotFound("Page not found")
	}
	return p, nil
}

var slugPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,99}$`)

// Upsert 创建或更新页面（PUT /admin/pages/{slug} 语义）；body 白名单过滤。
func (s *PageService) Upsert(slug string, in PageInput) (*model.Page, error) {
	slug = strings.ToLower(strings.TrimSpace(slug))
	if !slugPattern.MatchString(slug) {
		return nil, apperr.InvalidField("slug", "must match ^[a-z0-9][a-z0-9-]{0,99}$")
	}
	fields := map[string]string{}
	in.Title = strings.TrimSpace(in.Title)
	if in.Title == "" || charCount(in.Title) > 200 {
		fields["title"] = "required, max 200 chars"
	}
	switch in.Status {
	case "draft", "published":
	default:
		fields["status"] = "must be draft|published"
	}
	if len(in.Body) > 500_000 {
		fields["body"] = "max 500KB"
	}
	if charCount(in.SEOTitle) > 200 {
		fields["seo_title"] = "max 200 chars"
	}
	if charCount(in.SEODesc) > 500 {
		fields["seo_desc"] = "max 500 chars"
	}
	if len(fields) > 0 {
		return nil, apperr.Invalid(fields)
	}
	p := &model.Page{
		Slug: slug, Title: in.Title, Body: SanitizeHTML(in.Body),
		Status: in.Status, SEOTitle: in.SEOTitle, SEODesc: in.SEODesc,
	}
	if err := s.repo.Upsert(p); err != nil {
		return nil, apperr.Internal(err.Error())
	}
	return p, nil
}

// EnsureDefaults 首次启动播种 about-us 与 privacy-policy 占位页面。
func (s *PageService) EnsureDefaults() error {
	n, err := s.repo.Count()
	if err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	seed := []PageInput{
		{
			Title: "About Us", Status: "published",
			Body: "<h2>Your Trusted Seamless Cap Factory</h2><p>We are a source factory in Yiwu, China, specializing in seamless baseball caps. Update this page from the admin panel.</p>",
		},
		{
			Title: "Privacy Policy", Status: "published",
			Body: "<h2>Privacy Policy</h2><p>We only use the information you submit through our inquiry form to respond to your request. We never sell your data. Update this page from the admin panel.</p>",
		},
	}
	for _, in := range seed {
		if _, err := s.Upsert(strings.ToLower(strings.ReplaceAll(in.Title, " ", "-")), in); err != nil {
			return err
		}
	}
	return nil
}

// ---- 受控 HTML 白名单过滤见 sanitize.go ----
