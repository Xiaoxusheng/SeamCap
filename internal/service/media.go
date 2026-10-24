package service

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"path/filepath"
	"strings"

	"seamcap/internal/apperr"
	"seamcap/internal/model"
	"seamcap/internal/repository"
	"seamcap/internal/storage"
)

// MediaService 媒体上传/管理。
type MediaService struct {
	repo  *repository.MediaRepo
	store storage.Storage

	maxImageMB int
	maxVideoMB int
}

func NewMediaService(repo *repository.MediaRepo, store storage.Storage, maxImageMB, maxVideoMB int) *MediaService {
	return &MediaService{repo, store, maxImageMB, maxVideoMB}
}

// sniffAndLimit 读取头部嗅探真实类型，返回 mime、限流大小与重拼 reader。
func sniffAndLimit(r io.Reader, maxImageMB, maxVideoMB int) (string, io.Reader, int64, error) {
	head := make([]byte, storage.SniffLen)
	n, err := io.ReadFull(r, head)
	if err != nil && err != io.EOF && err != io.ErrUnexpectedEOF {
		return "", nil, 0, apperr.InvalidField("file", "cannot read file")
	}
	mime, _, ok := storage.DetectMime(head[:n])
	if !ok {
		return "", nil, 0, apperr.InvalidField("file", "unsupported file type (allowed: jpeg/png/webp/avif/mp4)")
	}
	limit := int64(maxImageMB) << 20
	if mime == "video/mp4" {
		limit = int64(maxVideoMB) << 20
	}
	return mime, io.MultiReader(bytes.NewReader(head[:n]), r), limit, nil
}

func mapStorageErr(err error) error {
	var sle *storage.SizeLimitError
	switch {
	case errors.As(err, &sle):
		return apperr.TooLarge("File exceeds size limit")
	case errors.Is(err, storage.ErrEmptyFile):
		return apperr.InvalidField("file", "empty file")
	case strings.Contains(err.Error(), "unsupported file type"):
		return apperr.InvalidField("file", "unsupported file type")
	default:
		return apperr.Internal(err.Error())
	}
}

// Upload 上传媒体：真实格式校验→大小限制→安全文件名→去重→落库。
func (s *MediaService) Upload(originalName string, r io.Reader, altText string) (*model.Media, error) {
	mime, reader, limit, err := sniffAndLimit(r, s.maxImageMB, s.maxVideoMB)
	if err != nil {
		return nil, err
	}
	// 原始名仅存元数据：剥离路径成分并按字符截断（保留扩展名）
	originalName = filepath.Base(strings.ReplaceAll(originalName, "\\", "/"))
	originalName = truncateTail(originalName, 255)
	filename, size, sha, mime2, w, h, serr := s.store.Save(reader, limit)
	if serr != nil {
		return nil, mapStorageErr(serr)
	}
	_ = mime2

	altText = truncateChars(altText, 500)
	// 内容去重：同 sha256 复用已有资产
	if existing, gerr := s.repo.GetBySHA256(sha); gerr == nil && existing != nil {
		_ = s.store.Delete(filename)
		return existing, nil
	}

	m := &model.Media{
		Filename: filename, OriginalName: originalName, AltText: altText,
		MimeType: mime, SizeBytes: size, Width: w, Height: h, SHA256: sha,
	}
	if _, err := s.repo.Create(m); err != nil {
		_ = s.store.Delete(filename)
		return nil, apperr.Internal(err.Error())
	}
	m.URL = s.store.URL(m.Filename)
	return m, nil
}

// Replace 替换文件内容（同 mime 校验）。内容写入新的安全文件名，
// 旧文件在元数据更新成功后删除：URL 随内容变化，immutable 缓存不会读到旧图。
func (s *MediaService) Replace(id int64, r io.Reader) (*model.Media, error) {
	m, err := s.repo.GetByID(id)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	if m == nil {
		return nil, apperr.NotFound("Media not found")
	}
	mime, reader, limit, err := sniffAndLimit(r, s.maxImageMB, s.maxVideoMB)
	if err != nil {
		return nil, err
	}
	if mime != m.MimeType {
		return nil, apperr.InvalidField("file", "mime type "+mime+" does not match existing asset "+m.MimeType)
	}
	filename, size, sha, _, w, h, serr := s.store.Save(reader, limit)
	if serr != nil {
		return nil, mapStorageErr(serr)
	}
	if err := s.repo.ReplaceFile(id, filename, mime, size, w, h, sha); err != nil {
		_ = s.store.Delete(filename)
		return nil, apperr.Internal(err.Error())
	}
	_ = s.store.Delete(m.Filename)
	return s.repo.GetByID(id)
}

// UpdateAlt 更新替代文本。
func (s *MediaService) UpdateAlt(id int64, alt string) (*model.Media, error) {
	m, err := s.repo.GetByID(id)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	if m == nil {
		return nil, apperr.NotFound("Media not found")
	}
	alt = truncateChars(alt, 500)
	if err := s.repo.UpdateAlt(id, alt); err != nil {
		return nil, apperr.Internal(err.Error())
	}
	m.AltText = alt
	return m, nil
}

// List 管理列表。
func (s *MediaService) List(q string, page, perPage int) ([]model.Media, model.Pagination, error) {
	if perPage < 1 || perPage > 100 {
		perPage = 24
	}
	if page < 1 {
		page = 1
	}
	items, total, err := s.repo.List(q, page, perPage)
	if err != nil {
		return nil, model.Pagination{}, apperr.Internal(err.Error())
	}
	return items, model.Pagination{Page: page, PerPage: perPage, Total: total}, nil
}

// Get 详情。
func (s *MediaService) Get(id int64) (*model.Media, error) {
	m, err := s.repo.GetByID(id)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	if m == nil {
		return nil, apperr.NotFound("Media not found")
	}
	return m, nil
}

// Delete 删除：引用计数>0 时 409 并列出引用来源；否则删文件+记录。
func (s *MediaService) Delete(id int64) error {
	m, err := s.repo.GetByID(id)
	if err != nil {
		return apperr.Internal(err.Error())
	}
	if m == nil {
		return apperr.NotFound("Media not found")
	}
	n, refs, err := s.repo.RefCount(id)
	if err != nil {
		return apperr.Internal(err.Error())
	}
	if n > 0 {
		return &apperr.Error{
			Code:    apperr.CodeConflict,
			Message: "Media is still referenced and cannot be deleted",
			Fields:  map[string]string{"reference_count": itoa(n), "references": strings.Join(refs, "; ")},
		}
	}
	// 先删数据库记录：失败时文件仍在，可重试；
	// 删文件失败只留下孤儿文件，不会出现“记录在但文件没了”。
	if err := s.repo.Delete(id); err != nil {
		return apperr.Internal(err.Error())
	}
	if err := s.store.Delete(m.Filename); err != nil {
		slog.Warn("media file delete failed", "media_id", id, "filename", m.Filename, "error", err.Error())
	}
	return nil
}

func itoa(n int64) string {
	return fmt.Sprint(n)
}
