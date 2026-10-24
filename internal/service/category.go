package service

import (
	"fmt"
	"strings"

	"seamcap/internal/apperr"
	"seamcap/internal/model"
	"seamcap/internal/repository"
)

// CategoryService 分类业务逻辑。
type CategoryService struct {
	repo     *repository.CategoryRepo
	products *repository.ProductRepo
	media    *repository.MediaRepo
}

func NewCategoryService(repo *repository.CategoryRepo, products *repository.ProductRepo, media *repository.MediaRepo) *CategoryService {
	return &CategoryService{repo, products, media}
}

// CategoryInput 创建/更新分类入参。
type CategoryInput struct {
	Name        string `json:"name"`
	NameEn      string `json:"name_en"`
	Slug        string `json:"slug"`
	Description string `json:"description"`
	ImageID     *int64 `json:"image_id"`
	SortOrder   int    `json:"sort_order"`
	Status      string `json:"status"`
}

// ListPublic 公开分类（仅 active，按 sort_order）。
func (s *CategoryService) ListPublic() ([]model.Category, error) {
	items, err := s.repo.ListPublic()
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	return items, nil
}

// ListAdmin 全部分类，附带各分类产品数。
func (s *CategoryService) ListAdmin() ([]model.Category, error) {
	items, err := s.repo.ListAdmin()
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	counts, err := s.products.CountByCategory()
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	for i := range items {
		items[i].ProductCount = counts[items[i].ID]
	}
	return items, nil
}

func (s *CategoryService) get(id int64) (*model.Category, error) {
	c, err := s.repo.GetByID(id)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	if c == nil {
		return nil, apperr.NotFound("Category not found")
	}
	return c, nil
}

// GetAdminByID 管理详情。
func (s *CategoryService) GetAdminByID(id int64) (*model.Category, error) { return s.get(id) }

func validateCategoryInput(in *CategoryInput) error {
	fields := map[string]string{}
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" || len(in.Name) > 200 {
		fields["name"] = "required, max 200 chars"
	}
	switch in.Status {
	case "active", "inactive":
	default:
		fields["status"] = "must be active|inactive"
	}
	if len(in.Description) > 2000 {
		fields["description"] = "max 2000 chars"
	}
	if len(fields) > 0 {
		return apperr.Invalid(fields)
	}
	return nil
}

func (s *CategoryService) ensureUniqueSlug(desired string, excludeID int64) *apperr.Error {
	existing, err := s.repo.GetBySlug(desired)
	if err != nil {
		return apperr.Internal(err.Error())
	}
	if existing != nil && existing.ID != excludeID {
		return apperr.Conflict(fmt.Sprintf("category slug %q already exists", desired))
	}
	return nil
}

// Create 新增分类。
func (s *CategoryService) Create(in CategoryInput) (*model.Category, error) {
	if err := validateCategoryInput(&in); err != nil {
		return nil, err
	}
	if in.ImageID != nil {
		m, err := s.media.GetByID(*in.ImageID)
		if err != nil {
			return nil, apperr.Internal(err.Error())
		}
		if m == nil {
			return nil, apperr.InvalidField("image_id", "media not found")
		}
	}
	slug := slugify(strings.TrimSpace(in.Slug))
	if strings.TrimSpace(in.Slug) == "" {
		base := in.NameEn
		if strings.TrimSpace(base) == "" {
			base = in.Name
		}
		slug = slugify(base)
	}
	if aerr := s.ensureUniqueSlug(slug, 0); aerr != nil {
		return nil, aerr
	}
	c := &model.Category{
		Name: in.Name, NameEn: in.NameEn, Slug: slug, Description: in.Description,
		ImageID: in.ImageID, SortOrder: in.SortOrder, Status: in.Status,
	}
	if _, err := s.repo.Create(c); err != nil {
		return nil, apperr.Internal(err.Error())
	}
	return c, nil
}

// Update 更新分类。
func (s *CategoryService) Update(id int64, in CategoryInput) (*model.Category, error) {
	c, err := s.get(id)
	if err != nil {
		return nil, err
	}
	if err := validateCategoryInput(&in); err != nil {
		return nil, err
	}
	if in.ImageID != nil {
		m, err := s.media.GetByID(*in.ImageID)
		if err != nil {
			return nil, apperr.Internal(err.Error())
		}
		if m == nil {
			return nil, apperr.InvalidField("image_id", "media not found")
		}
	}
	slug := strings.TrimSpace(in.Slug)
	if slug == "" {
		base := in.NameEn
		if strings.TrimSpace(base) == "" {
			base = in.Name
		}
		slug = slugify(base)
	} else {
		slug = slugify(slug)
	}
	if slug != c.Slug {
		if aerr := s.ensureUniqueSlug(slug, id); aerr != nil {
			return nil, aerr
		}
	}
	c.Name = in.Name
	c.NameEn = in.NameEn
	c.Slug = slug
	c.Description = in.Description
	c.ImageID = in.ImageID
	c.SortOrder = in.SortOrder
	c.Status = in.Status
	if err := s.repo.Update(c); err != nil {
		return nil, apperr.Internal(err.Error())
	}
	return c, nil
}

// DeleteResult 删除策略结果。
type DeleteResult struct {
	Deleted    bool  `json:"deleted"`
	Archived   bool  `json:"archived"`
	Reassigned int64 `json:"reassigned,omitempty"`
}

// Delete 删除分类：
//   - 仍有产品关联时返回 409（body 指明数量）；
//   - ?mode=reassign&to={id}：迁移产品后删除；
//   - ?mode=archive：仅停用。
func (s *CategoryService) Delete(id int64, mode string, toID int64) (*DeleteResult, error) {
	c, err := s.get(id)
	if err != nil {
		return nil, err
	}
	if mode == "archive" {
		if err := s.repo.Archive(id); err != nil {
			return nil, apperr.Internal(err.Error())
		}
		return &DeleteResult{Archived: true}, nil
	}
	counts, err := s.products.CountByCategory()
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	n := counts[id]
	if n > 0 {
		if mode != "reassign" {
			return nil, &apperr.Error{
				Code:    apperr.CodeConflict,
				Message: fmt.Sprintf("category %q still has %d product(s)", c.Name, n),
				Fields: map[string]string{
					"product_count": fmt.Sprint(n),
					"hint":          "use ?mode=reassign&to={id} to move products then delete, or ?mode=archive to deactivate",
				},
			}
		}
		if toID == 0 || toID == id {
			return nil, apperr.InvalidField("to", "valid target category id required")
		}
		target, err := s.repo.GetByID(toID)
		if err != nil {
			return nil, apperr.Internal(err.Error())
		}
		if target == nil {
			return nil, apperr.InvalidField("to", "target category not found")
		}
		moved, err := s.products.ReassignCategory(id, toID)
		if err != nil {
			return nil, apperr.Internal(err.Error())
		}
		if err := s.repo.Delete(id); err != nil {
			return nil, apperr.Internal(err.Error())
		}
		return &DeleteResult{Deleted: true, Reassigned: moved}, nil
	}
	if err := s.repo.Delete(id); err != nil {
		return nil, apperr.Internal(err.Error())
	}
	return &DeleteResult{Deleted: true}, nil
}
