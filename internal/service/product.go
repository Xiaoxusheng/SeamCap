package service

import (
	"fmt"
	"regexp"
	"strings"

	"seamcap/internal/apperr"
	"seamcap/internal/model"
	"seamcap/internal/repository"
	"seamcap/internal/storage"
)

// ProductService 产品业务逻辑。
type ProductService struct {
	repo  *repository.ProductRepo
	cats  *repository.CategoryRepo
	media *repository.MediaRepo
}

func NewProductService(repo *repository.ProductRepo, cats *repository.CategoryRepo, media *repository.MediaRepo) *ProductService {
	return &ProductService{repo, cats, media}
}

// Repo 供 handler/SEO 层读取底层仓库（sitemap 等）。
func (s *ProductService) Repo() *repository.ProductRepo { return s.repo }

// ProductInput 创建/更新产品入参。
type ProductInput struct {
	Name          string `json:"name"`
	SKU           string `json:"sku"`
	Slug          string `json:"slug"`
	CategoryID    *int64 `json:"category_id"`
	ShortDesc     string `json:"short_desc"`
	DetailDesc    string `json:"detail_desc"`
	Note          string `json:"note"` // 产品笔记 JSON 字符串
	Material      string `json:"material"`
	CapShape      string `json:"cap_shape"`
	Colors        string `json:"colors"`
	Sizes         string `json:"sizes"`
	Customization string `json:"customization"`
	MainImageID   *int64 `json:"main_image_id"`
	VideoURL      string `json:"video_url"`
	IsFeatured    bool   `json:"is_featured"`
	SortOrder     int    `json:"sort_order"`
	Status        string `json:"status"`
	SEOTitle      string `json:"seo_title"`
	SEODesc       string `json:"seo_desc"`
}

var slugRe = regexp.MustCompile(`[^a-z0-9]+`)

// slugify 生成 URL 友好 slug；无法从名称派生时返回空串（由调用方按类型兜底）。
func slugify(name string) string {
	s := strings.ToLower(strings.TrimSpace(name))
	s = slugRe.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	if len(s) > 80 {
		s = strings.Trim(s[:80], "-")
	}
	return s
}

// fallbackSlug 名称无法转成 ASCII slug（如中文）时的类型前缀兜底。
func fallbackSlug(prefix string) string {
	return prefix + "-" + strings.ToLower(storage.NewULID())
}

// ProductListParams 公开列表参数。
type ProductListParams struct {
	Q            string
	CategorySlug string
	CategoryID   *int64
	Page         int
	PerPage      int
	Sort         string // recommended | updated
}

// ListPublic 公开列表（仅 published）。
func (s *ProductService) ListPublic(p ProductListParams) ([]model.Product, model.Pagination, error) {
	if p.PerPage < 1 || p.PerPage > 60 {
		p.PerPage = 12
	}
	if p.Page < 1 {
		p.Page = 1
	}
	if p.Sort != "updated" {
		p.Sort = "recommended"
	}
	items, total, err := s.repo.ListPublic(p.Q, p.CategorySlug, p.CategoryID, p.Page, p.PerPage, p.Sort)
	if err != nil {
		return nil, model.Pagination{}, apperr.Internal(err.Error())
	}
	return items, model.Pagination{Page: p.Page, PerPage: p.PerPage, Total: total}, nil
}

// ListAdmin 管理列表（含草稿）。
func (s *ProductService) ListAdmin(q string, categoryID *int64, status string, page, perPage int) ([]model.Product, model.Pagination, error) {
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	if page < 1 {
		page = 1
	}
	items, total, err := s.repo.ListAdmin(q, categoryID, status, page, perPage)
	if err != nil {
		return nil, model.Pagination{}, apperr.Internal(err.Error())
	}
	return items, model.Pagination{Page: page, PerPage: perPage, Total: total}, nil
}

// GetPublicBySlug 公开详情（仅 published，否则 404），含图片与相关产品。
func (s *ProductService) GetPublicBySlug(slug string) (*model.Product, error) {
	p, err := s.repo.GetPublicBySlug(slug)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	if p == nil {
		return nil, apperr.NotFound("Product not found")
	}
	related, err := s.repo.RelatedProducts(p, 4)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	p.Related = related
	return p, nil
}

// GetAdminByID 管理详情。
func (s *ProductService) GetAdminByID(id int64) (*model.Product, error) {
	p, err := s.repo.GetByID(id)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	if p == nil {
		return nil, apperr.NotFound("Product not found")
	}
	return p, nil
}

func validateProductInput(in *ProductInput) error {
	fields := map[string]string{}
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" || charCount(in.Name) > 200 {
		fields["name"] = "required, max 200 chars"
	}
	if charCount(in.SKU) > 100 {
		fields["sku"] = "max 100 chars"
	}
	switch in.Status {
	case "draft", "published", "archived":
	default:
		fields["status"] = "must be draft|published|archived"
	}
	if charCount(in.VideoURL) > 500 {
		fields["video_url"] = "max 500 chars"
	}
	if charCount(in.SEOTitle) > 200 {
		fields["seo_title"] = "max 200 chars"
	}
	if charCount(in.SEODesc) > 500 {
		fields["seo_desc"] = "max 500 chars"
	}
	if charCount(in.Note) > 20000 {
		fields["note"] = "max 20000 chars"
	}
	if in.CategoryID != nil && *in.CategoryID <= 0 {
		fields["category_id"] = "invalid"
	}
	if len(fields) > 0 {
		return apperr.Invalid(fields)
	}
	return nil
}

// uniqueSlug 校验/生成唯一 slug。
// auto=true（slug 由名称自动生成）时自动去重（-2、-3…）；
// auto=false（用户显式指定）时冲突返回 409 + 自动建议。
func (s *ProductService) uniqueSlug(desired string, excludeID int64, auto bool) (string, *apperr.Error) {
	check := func(slug string) (bool, error) {
		existing, err := s.repo.GetBySlug(slug)
		if err != nil {
			return false, err
		}
		return existing == nil || existing.ID == excludeID, nil
	}
	free, err := check(desired)
	if err != nil {
		return "", apperr.Internal(err.Error())
	}
	if free {
		return desired, nil
	}
	if !auto {
		for i := 2; i < 100; i++ {
			cand := fmt.Sprintf("%s-%d", desired, i)
			free, err := check(cand)
			if err != nil {
				return "", apperr.Internal(err.Error())
			}
			if free {
				return "", &apperr.Error{
					Code:    apperr.CodeConflict,
					Message: fmt.Sprintf("slug %q already exists", desired),
					Fields:  map[string]string{"slug": "already exists", "suggestion": cand},
				}
			}
		}
		return "", apperr.Conflict(fmt.Sprintf("slug %q already exists", desired))
	}
	// 自动去重
	for i := 2; i < 1000; i++ {
		cand := fmt.Sprintf("%s-%d", desired, i)
		free, err := check(cand)
		if err != nil {
			return "", apperr.Internal(err.Error())
		}
		if free {
			return cand, nil
		}
	}
	return "", apperr.Conflict(fmt.Sprintf("cannot derive unique slug for %q", desired))
}

// Create 新增产品。
func (s *ProductService) Create(in ProductInput) (*model.Product, error) {
	if err := validateProductInput(&in); err != nil {
		return nil, err
	}
	if in.CategoryID != nil {
		cat, err := s.cats.GetByID(*in.CategoryID)
		if err != nil {
			return nil, apperr.Internal(err.Error())
		}
		if cat == nil {
			return nil, apperr.InvalidField("category_id", "category not found")
		}
	}
	if in.MainImageID != nil {
		m, err := s.media.GetByID(*in.MainImageID)
		if err != nil {
			return nil, apperr.Internal(err.Error())
		}
		if m == nil {
			return nil, apperr.InvalidField("main_image_id", "media not found")
		}
	}
	slug := strings.TrimSpace(in.Slug)
	explicit := slug != ""
	if explicit {
		slug = slugify(slug)
		if slug == "" {
			return nil, apperr.InvalidField("slug", "must contain a-z, 0-9 or hyphen")
		}
	} else {
		slug = slugify(in.Name)
		if slug == "" {
			slug = fallbackSlug("product")
		}
	}
	finalSlug, aerr := s.uniqueSlug(slug, 0, !explicit)
	if aerr != nil {
		return nil, aerr
	}
		p := &model.Product{
		Name: in.Name, SKU: strings.TrimSpace(in.SKU), Slug: finalSlug,
		CategoryID: in.CategoryID, ShortDesc: in.ShortDesc, DetailDesc: in.DetailDesc, Note: in.Note,
		Material: in.Material, CapShape: in.CapShape, Colors: in.Colors, Sizes: in.Sizes,
		Customization: in.Customization, MainImageID: in.MainImageID, VideoURL: in.VideoURL,
		IsFeatured: in.IsFeatured, SortOrder: in.SortOrder, Status: in.Status,
		SEOTitle: in.SEOTitle, SEODesc: in.SEODesc,
	}
	if p.Status == "published" {
		now := repository.Now()
		p.PublishedAt = &now
	}
	if _, err := s.repo.Create(p); err != nil {
		return nil, apperr.Internal(err.Error())
	}
	return p, nil
}

// Update 更新产品。
func (s *ProductService) Update(id int64, in ProductInput) (*model.Product, error) {
	existing, err := s.repo.GetByID(id)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	if existing == nil {
		return nil, apperr.NotFound("Product not found")
	}
	if err := validateProductInput(&in); err != nil {
		return nil, err
	}
	if in.CategoryID != nil {
		cat, err := s.cats.GetByID(*in.CategoryID)
		if err != nil {
			return nil, apperr.Internal(err.Error())
		}
		if cat == nil {
			return nil, apperr.InvalidField("category_id", "category not found")
		}
	}
	if in.MainImageID != nil {
		m, err := s.media.GetByID(*in.MainImageID)
		if err != nil {
			return nil, apperr.Internal(err.Error())
		}
		if m == nil {
			return nil, apperr.InvalidField("main_image_id", "media not found")
		}
	}
	slug := strings.TrimSpace(in.Slug)
	if slug == "" {
		// 自动派生；中文等无法派生时保留原 slug，避免每次保存都换 URL
		if derived := slugify(in.Name); derived != "" {
			slug = derived
		} else if existing.Slug != "" {
			slug = existing.Slug
		} else {
			slug = fallbackSlug("product")
		}
	} else {
		slug = slugify(slug)
		if slug == "" {
			return nil, apperr.InvalidField("slug", "must contain a-z, 0-9 or hyphen")
		}
	}
	if slug != existing.Slug {
		if _, aerr := s.uniqueSlug(slug, id, false); aerr != nil {
			return nil, aerr
		}
	}
	existing.Name = in.Name
	existing.SKU = strings.TrimSpace(in.SKU)
	existing.Slug = slug
	existing.CategoryID = in.CategoryID
	existing.ShortDesc = in.ShortDesc
	existing.DetailDesc = in.DetailDesc
	existing.Note = in.Note
	existing.Material = in.Material
	existing.CapShape = in.CapShape
	existing.Colors = in.Colors
	existing.Sizes = in.Sizes
	existing.Customization = in.Customization
	existing.MainImageID = in.MainImageID
	existing.VideoURL = in.VideoURL
	existing.IsFeatured = in.IsFeatured
	existing.SortOrder = in.SortOrder
	existing.Status = in.Status
	existing.SEOTitle = in.SEOTitle
	existing.SEODesc = in.SEODesc
	// 首次发布时记录 published_at
	if in.Status == "published" && existing.PublishedAt == nil {
		now := repository.Now()
		existing.PublishedAt = &now
	}
	if err := s.repo.Update(existing); err != nil {
		return nil, apperr.Internal(err.Error())
	}
	return existing, nil
}

// Delete 删除产品（询价快照由 DB 冗余字段保留）。
func (s *ProductService) Delete(id int64) error {
	p, err := s.repo.GetByID(id)
	if err != nil {
		return apperr.Internal(err.Error())
	}
	if p == nil {
		return apperr.NotFound("Product not found")
	}
	if err := s.repo.Delete(id); err != nil {
		return apperr.Internal(err.Error())
	}
	return nil
}

// Duplicate 复制为新草稿（slug 加 -copy 后缀，冲突时 -copy-2…）。
func (s *ProductService) Duplicate(id int64) (*model.Product, error) {
	src, err := s.repo.GetByID(id)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	if src == nil {
		return nil, apperr.NotFound("Product not found")
	}
	base := src.Slug + "-copy"
	finalSlug := ""
	for i := 0; i < 100; i++ {
		cand := base
		if i > 0 {
			cand = fmt.Sprintf("%s-%d", base, i+1)
		}
		existing, err := s.repo.GetBySlug(cand)
		if err != nil {
			return nil, apperr.Internal(err.Error())
		}
		if existing == nil {
			finalSlug = cand
			break
		}
	}
	if finalSlug == "" {
		return nil, apperr.Conflict("cannot derive a unique slug for the copy")
	}
	p := &model.Product{
		Name: src.Name + " (Copy)", SKU: src.SKU, Slug: finalSlug,
		CategoryID: src.CategoryID, ShortDesc: src.ShortDesc, DetailDesc: src.DetailDesc, Note: src.Note,
		Material: src.Material, CapShape: src.CapShape, Colors: src.Colors, Sizes: src.Sizes,
		Customization: src.Customization, MainImageID: src.MainImageID, VideoURL: src.VideoURL,
		IsFeatured: false, SortOrder: src.SortOrder, Status: "draft",
		SEOTitle: src.SEOTitle, SEODesc: src.SEODesc,
	}
	if _, err := s.repo.Create(p); err != nil {
		return nil, apperr.Internal(err.Error())
	}
	// 复制媒体关联
	var links []model.MediaLink
	for _, img := range src.Images {
		links = append(links, model.MediaLink{MediaID: img.ID, Role: img.Role, SortOrder: img.SortOrder})
	}
	if len(links) > 0 {
		if err := s.media.SetProductMedia(p.ID, links); err != nil {
			return nil, apperr.Internal(err.Error())
		}
	}
	return s.repo.GetByID(p.ID)
}

// MediaRefInput 产品媒体关联（重排/增删）。
type MediaRefInput struct {
	MediaID   int64  `json:"media_id"`
	Role      string `json:"role"`
	SortOrder int    `json:"sort_order"`
}

// SetMedia 整体替换产品媒体关联；提供 main 角色时同步 main_image_id。
func (s *ProductService) SetMedia(productID int64, refs []MediaRefInput) (*model.Product, error) {
	p, err := s.repo.GetByID(productID)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	if p == nil {
		return nil, apperr.NotFound("Product not found")
	}
	fields := map[string]string{}
	mainCount := 0
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
		switch r.Role {
		case "main", "gallery", "detail", "":
		default:
			fields[fmt.Sprintf("items[%d].role", i)] = "must be main|gallery|detail"
			continue
		}
		if r.Role == "main" {
			mainCount++
		}
		role := r.Role
		if role == "" {
			role = "gallery"
		}
		links = append(links, model.MediaLink{MediaID: r.MediaID, Role: role, SortOrder: r.SortOrder})
	}
	if mainCount > 1 {
		fields["items"] = "at most one media with role 'main'"
	}
	if len(fields) > 0 {
		return nil, apperr.Invalid(fields)
	}
	if err := s.media.SetProductMedia(productID, links); err != nil {
		return nil, apperr.Internal(err.Error())
	}
	// 主图与关联列表保持一致：
	// - items 中有 main 角色 → 取排序最小的 main；
	// - 当前主图不在 items 中 → 清除（product_media 为图片事实来源）。
	mainSynced := false
	for _, l := range links {
		if l.Role == "main" {
			id := l.MediaID
			p.MainImageID = &id
			mainSynced = true
			break
		}
	}
	if !mainSynced && p.MainImageID != nil {
		inItems := false
		for _, l := range links {
			if l.MediaID == *p.MainImageID {
				inItems = true
				break
			}
		}
		if !inItems {
			p.MainImageID = nil
		}
	}
	if err := s.repo.Update(p); err != nil {
		return nil, apperr.Internal(err.Error())
	}
	return s.repo.GetByID(productID)
}
