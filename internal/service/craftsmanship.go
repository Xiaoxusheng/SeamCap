package service

import (
	"fmt"
	"strings"

	"seamcap/internal/apperr"
	"seamcap/internal/model"
	"seamcap/internal/repository"
)

// CraftService 工艺内容业务逻辑。
type CraftService struct {
	repo  *repository.CraftRepo
	media *repository.MediaRepo
}

func NewCraftService(repo *repository.CraftRepo, media *repository.MediaRepo) *CraftService {
	return &CraftService{repo, media}
}

// CraftInput 创建/更新工艺入参。
type CraftInput struct {
	Title        string `json:"title"`
	Slug         string `json:"slug"`
	Summary      string `json:"summary"`
	Body         string `json:"body"`
	CoverImageID *int64 `json:"cover_image_id"`
	VideoURL     string `json:"video_url"`
	SortOrder    int    `json:"sort_order"`
	Status       string `json:"status"`
	SEOTitle     string `json:"seo_title"`
	SEODesc      string `json:"seo_desc"`
}

// Repo 供 handler/SEO 层读取底层仓库（sitemap 等）。
func (s *CraftService) Repo() *repository.CraftRepo { return s.repo }

// ListPublic 已发布列表。
func (s *CraftService) ListPublic() ([]model.Craftsmanship, error) {
	items, err := s.repo.ListPublic()
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	return items, nil
}

// ListAdmin 全部。
func (s *CraftService) ListAdmin() ([]model.Craftsmanship, error) {
	items, err := s.repo.ListAdmin()
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	return items, nil
}

func (s *CraftService) get(id int64) (*model.Craftsmanship, error) {
	c, err := s.repo.GetByID(id)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	if c == nil {
		return nil, apperr.NotFound("Craftsmanship not found")
	}
	return c, nil
}

// GetPublicBySlug 公开详情（仅 published）。
func (s *CraftService) GetPublicBySlug(slug string) (*model.Craftsmanship, error) {
	c, err := s.repo.GetPublicBySlug(slug)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	if c == nil {
		return nil, apperr.NotFound("Craftsmanship not found")
	}
	return c, nil
}

// GetAdminByID 管理详情。
func (s *CraftService) GetAdminByID(id int64) (*model.Craftsmanship, error) { return s.get(id) }

func validateCraftInput(in *CraftInput) error {
	fields := map[string]string{}
	in.Title = strings.TrimSpace(in.Title)
	if in.Title == "" || len(in.Title) > 200 {
		fields["title"] = "required, max 200 chars"
	}
	switch in.Status {
	case "draft", "published", "hidden":
	default:
		fields["status"] = "must be draft|published|hidden"
	}
	if len(in.Summary) > 1000 {
		fields["summary"] = "max 1000 chars"
	}
	if len(in.VideoURL) > 500 {
		fields["video_url"] = "max 500 chars"
	}
	if len(fields) > 0 {
		return apperr.Invalid(fields)
	}
	return nil
}

func (s *CraftService) ensureUniqueSlug(desired string, excludeID int64) *apperr.Error {
	existing, err := s.repo.GetBySlug(desired)
	if err != nil {
		return apperr.Internal(err.Error())
	}
	if existing != nil && existing.ID != excludeID {
		return apperr.Conflict("craftsmanship slug already exists: " + desired)
	}
	return nil
}

// Create 新增工艺。
func (s *CraftService) Create(in CraftInput) (*model.Craftsmanship, error) {
	if err := validateCraftInput(&in); err != nil {
		return nil, err
	}
	if in.CoverImageID != nil {
		m, err := s.media.GetByID(*in.CoverImageID)
		if err != nil {
			return nil, apperr.Internal(err.Error())
		}
		if m == nil {
			return nil, apperr.InvalidField("cover_image_id", "media not found")
		}
	}
	slug := slugify(strings.TrimSpace(in.Slug))
	if strings.TrimSpace(in.Slug) == "" {
		slug = slugify(in.Title)
	}
	if aerr := s.ensureUniqueSlug(slug, 0); aerr != nil {
		return nil, aerr
	}
	c := &model.Craftsmanship{
		Title: in.Title, Slug: slug, Summary: in.Summary, Body: SanitizeHTML(in.Body),
		CoverImageID: in.CoverImageID, VideoURL: in.VideoURL, SortOrder: in.SortOrder,
		Status: in.Status, SEOTitle: in.SEOTitle, SEODesc: in.SEODesc,
	}
	if c.Status == "published" {
		now := repository.Now()
		c.PublishedAt = &now
	}
	if _, err := s.repo.Create(c); err != nil {
		return nil, apperr.Internal(err.Error())
	}
	return c, nil
}

// Update 更新工艺。
func (s *CraftService) Update(id int64, in CraftInput) (*model.Craftsmanship, error) {
	c, err := s.get(id)
	if err != nil {
		return nil, err
	}
	if err := validateCraftInput(&in); err != nil {
		return nil, err
	}
	if in.CoverImageID != nil {
		m, err := s.media.GetByID(*in.CoverImageID)
		if err != nil {
			return nil, apperr.Internal(err.Error())
		}
		if m == nil {
			return nil, apperr.InvalidField("cover_image_id", "media not found")
		}
	}
	slug := strings.TrimSpace(in.Slug)
	if slug == "" {
		slug = slugify(in.Title)
	} else {
		slug = slugify(slug)
	}
	if slug != c.Slug {
		if aerr := s.ensureUniqueSlug(slug, id); aerr != nil {
			return nil, aerr
		}
	}
	c.Title = in.Title
	c.Slug = slug
	c.Summary = in.Summary
	c.Body = SanitizeHTML(in.Body)
	c.CoverImageID = in.CoverImageID
	c.VideoURL = in.VideoURL
	c.SortOrder = in.SortOrder
	c.Status = in.Status
	c.SEOTitle = in.SEOTitle
	c.SEODesc = in.SEODesc
	if in.Status == "published" && c.PublishedAt == nil {
		now := repository.Now()
		c.PublishedAt = &now
	}
	if err := s.repo.Update(c); err != nil {
		return nil, apperr.Internal(err.Error())
	}
	return c, nil
}

// Delete 删除工艺。
func (s *CraftService) Delete(id int64) error {
	exists, err := s.repo.GetByID(id)
	if err != nil {
		return apperr.Internal(err.Error())
	}
	if exists == nil {
		return apperr.NotFound("Craftsmanship not found")
	}
	if err := s.repo.Delete(id); err != nil {
		return apperr.Internal(err.Error())
	}
	return nil
}

// CraftMediaRefInput 工艺媒体关联。
type CraftMediaRefInput struct {
	MediaID   int64 `json:"media_id"`
	SortOrder int   `json:"sort_order"`
}

// SetMedia 整体替换工艺媒体关联。
func (s *CraftService) SetMedia(craftID int64, refs []CraftMediaRefInput) (*model.Craftsmanship, error) {
	if _, err := s.get(craftID); err != nil {
		return nil, err
	}
	fields := map[string]string{}
	links := make([]model.MediaLink, 0, len(refs))
	for i, r := range refs {
		if r.MediaID <= 0 {
			fields[fmt.Sprintf("items[%d].media_id", i)] = "invalid"
			continue
		}
		m, err := s.media.GetByID(r.MediaID)
		if err != nil {
			return nil, apperr.Internal(err.Error())
		}
		if m == nil {
			fields[fmt.Sprintf("items[%d].media_id", i)] = "media not found"
			continue
		}
		links = append(links, model.MediaLink{MediaID: r.MediaID, SortOrder: r.SortOrder})
	}
	if len(fields) > 0 {
		return nil, apperr.Invalid(fields)
	}
	if err := s.media.SetCraftMedia(craftID, links); err != nil {
		return nil, apperr.Internal(err.Error())
	}
	return s.repo.GetByID(craftID)
}
