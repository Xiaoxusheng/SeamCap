// Package storage 文件存储模块。
//
// 接口抽象：第一期 LocalStorage 实现，预留 S3/OSS 适配。
// 安全：白名单 MIME + 真实格式嗅探（magic number）+ 大小限制 + ULID 安全文件名 + 路径穿越防护。
package storage

import (
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// Storage 存储接口（预留 S3/OSS 适配）。
type Storage interface {
	// Save 保存新文件，返回安全化文件名与元数据（形如 2026/10/<ULID>.jpg）
	Save(r io.Reader, sizeLimit int64) (filename string, size int64, sha256hex, mimeType string, width, height *int, err error)
	// Delete 删除文件（含路径穿越防护）
	Delete(filename string) error
	// URL 对外访问路径
	URL(filename string) string
}

// LocalStorage 本地磁盘实现。
type LocalStorage struct {
	baseDir string // e.g. ./uploads
}

func NewLocalStorage(baseDir string) (*LocalStorage, error) {
	if err := os.MkdirAll(baseDir, 0o755); err != nil {
		return nil, err
	}
	return &LocalStorage{baseDir: baseDir}, nil
}

func (s *LocalStorage) URL(filename string) string { return "/uploads/" + filename }

// validFilename 校验存储文件名，防路径穿越：只允许 yyyy/mm/ULID.ext 形式（ext 为白名单类型）。
var validFilename = regexp.MustCompile(`^[0-9]{4}/[0-9]{2}/[A-Za-z0-9]{26}\.(jpg|png|webp|avif|mp4)$`)

func (s *LocalStorage) abs(filename string) (string, error) {
	if !validFilename.MatchString(filename) || strings.Contains(filename, "..") {
		return "", fmt.Errorf("invalid storage filename: %q", filename)
	}
	return filepath.Join(s.baseDir, filepath.FromSlash(filename)), nil
}

// Save 嗅探→限流→落盘（失败自动清理半成品）。
func (s *LocalStorage) Save(r io.Reader, sizeLimit int64) (string, int64, string, string, *int, *int, error) {
	head := make([]byte, SniffLen)
	n, err := io.ReadFull(r, head)
	if err != nil && err != io.EOF && err != io.ErrUnexpectedEOF {
		return "", 0, "", "", nil, nil, err
	}
	head = head[:n]
	mimeType, ext, ok := DetectMime(head)
	if !ok {
		return "", 0, "", "", nil, nil, errors.New("unsupported file type")
	}
	filename := NewFilename(ext)
	absPath, err := s.abs(filename)
	if err != nil {
		return "", 0, "", "", nil, nil, err
	}
	if err := os.MkdirAll(filepath.Dir(absPath), 0o755); err != nil {
		return "", 0, "", "", nil, nil, err
	}
	size, sha, w, h, err := writeStream(head, r, absPath, sizeLimit, mimeType)
	if err != nil {
		os.Remove(absPath) // 清理半成品
		return "", 0, "", "", nil, nil, err
	}
	return filename, size, sha, mimeType, w, h, nil
}

// Delete 删除文件（含路径穿越防护）。
func (s *LocalStorage) Delete(filename string) error {
	absPath, err := s.abs(filename)
	if err != nil {
		return err
	}
	err = os.Remove(absPath)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	return err
}
