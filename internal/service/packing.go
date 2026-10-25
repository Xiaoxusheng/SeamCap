package service

import (
	"strings"

	"seamcap/internal/apperr"
	"seamcap/internal/model"
	"seamcap/internal/repository"
)

// PackingService 打包发货素材（前台图库）业务逻辑。
type PackingService struct {
	repo  *repository.PackingRepo
	media *repository.MediaRepo
}

func NewPackingService(repo *repository.PackingRepo, media *repository.MediaRepo) *PackingService {
	return &PackingService{repo, media}
}

// 素材分类（固定枚举，前端按 key 本地化展示）。
const (
	PackingCategoryPacking   = "packing"   // 打包
	PackingCategoryLoading   = "loading"   // 装车
	PackingCategoryWarehouse = "warehouse" // 仓储
)

var packingCategorySet = map[string]bool{
	PackingCategoryPacking:   true,
	PackingCategoryLoading:   true,
	PackingCategoryWarehouse: true,
}

// PackingInput 创建/更新素材入参。
type PackingInput struct {
	Category  string `json:"category"`
	Title     string `json:"title"`
	Caption   string `json:"caption"`
	MediaID   int64  `json:"media_id"`
	SortOrder int    `json:"sort_order"`
	Status    string `json:"status"`
}

// ListPublic 已发布素材。
func (s *PackingService) ListPublic() ([]model.PackingItem, error) {
	items, err := s.repo.ListPublic()
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	return items, nil
}

// ListAdmin 全部素材。
func (s *PackingService) ListAdmin() ([]model.PackingItem, error) {
	items, err := s.repo.ListAdmin()
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	return items, nil
}

// GetAdminByID 单条素材。
func (s *PackingService) GetAdminByID(id int64) (*model.PackingItem, error) {
	it, err := s.repo.GetByID(id)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	if it == nil {
		return nil, apperr.NotFound("Packing item not found")
	}
	return it, nil
}

// NextSort 追加排序值。
func (s *PackingService) NextSort() (int, error) {
	n, err := s.repo.NextSort()
	if err != nil {
		return 0, apperr.Internal(err.Error())
	}
	return n, nil
}

// Count 素材总数。
func (s *PackingService) Count() (int64, error) {
	n, err := s.repo.Count()
	if err != nil {
		return 0, apperr.Internal(err.Error())
	}
	return n, nil
}

func validatePackingInput(in *PackingInput) error {
	fields := map[string]string{}
	in.Category = strings.TrimSpace(in.Category)
	if in.Category == "" {
		in.Category = PackingCategoryPacking
	}
	if !packingCategorySet[in.Category] {
		fields["category"] = "must be packing|loading|warehouse"
	}
	in.Title = strings.TrimSpace(in.Title)
	in.Caption = strings.TrimSpace(in.Caption)
	if charCount(in.Title) > 200 {
		fields["title"] = "max 200 chars"
	}
	if charCount(in.Caption) > 500 {
		fields["caption"] = "max 500 chars"
	}
	if in.MediaID <= 0 {
		fields["media_id"] = "required"
	}
	if in.Status == "" {
		in.Status = "published"
	}
	switch in.Status {
	case "published", "hidden":
	default:
		fields["status"] = "must be published|hidden"
	}
	if len(fields) > 0 {
		return apperr.Invalid(fields)
	}
	return nil
}

// checkMedia 校验素材存在且为图片/视频。
func (s *PackingService) checkMedia(id int64) (string, *apperr.Error) {
	m, err := s.media.GetByID(id)
	if err != nil {
		return "", apperr.Internal(err.Error())
	}
	if m == nil {
		return "", apperr.InvalidField("media_id", "media not found")
	}
	if !strings.HasPrefix(m.MimeType, "image/") && !strings.HasPrefix(m.MimeType, "video/") {
		return "", apperr.InvalidField("media_id", "must be an image or video")
	}
	return m.MimeType, nil
}

// Create 新增素材。
func (s *PackingService) Create(in PackingInput) (*model.PackingItem, error) {
	if err := validatePackingInput(&in); err != nil {
		return nil, err
	}
	if _, aerr := s.checkMedia(in.MediaID); aerr != nil {
		return nil, aerr
	}
	it := &model.PackingItem{
		Category: in.Category, Title: in.Title, Caption: in.Caption,
		MediaID: in.MediaID, SortOrder: in.SortOrder, Status: in.Status,
	}
	if _, err := s.repo.Create(it); err != nil {
		return nil, apperr.Internal(err.Error())
	}
	return s.repo.GetByID(it.ID)
}

// Update 更新素材。
func (s *PackingService) Update(id int64, in PackingInput) (*model.PackingItem, error) {
	it, err := s.GetAdminByID(id)
	if err != nil {
		return nil, err
	}
	if err := validatePackingInput(&in); err != nil {
		return nil, err
	}
	if in.MediaID != it.MediaID {
		if _, aerr := s.checkMedia(in.MediaID); aerr != nil {
			return nil, aerr
		}
	}
	it.Category = in.Category
	it.Title = in.Title
	it.Caption = in.Caption
	it.MediaID = in.MediaID
	it.SortOrder = in.SortOrder
	it.Status = in.Status
	if err := s.repo.Update(it); err != nil {
		return nil, apperr.Internal(err.Error())
	}
	return s.repo.GetByID(id)
}

// Delete 删除素材（不动媒体库文件）。
func (s *PackingService) Delete(id int64) error {
	if _, err := s.GetAdminByID(id); err != nil {
		return err
	}
	if err := s.repo.Delete(id); err != nil {
		return apperr.Internal(err.Error())
	}
	return nil
}
