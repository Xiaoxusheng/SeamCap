package storage

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

// 用真实工厂照片回归：Save 写盘必须字节精确（排查"文件翻倍"问题）
func TestSaveByteExactRealJPEG(t *testing.T) {
	srcPath := filepath.Join("..", "..", "web", "static", "img", "cap-image-23.jpg")
	src, err := os.ReadFile(srcPath)
	if err != nil {
		t.Skip("source file not available:", err)
	}
	s, err := NewLocalStorage(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	filename, size, sha, mime, w, h, err := s.Save(bytes.NewReader(src), 10<<20)
	if err != nil {
		t.Fatalf("save: %v", err)
	}
	if size != int64(len(src)) {
		t.Errorf("size mismatch: got %d want %d", size, len(src))
	}
	abs, err := s.abs(filename)
	if err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(abs)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, src) {
		// 找到第一个分叉点
		n := len(got)
		if len(src) < n {
			n = len(src)
		}
		for i := 0; i < n; i++ {
			if got[i] != src[i] {
				t.Fatalf("bytes diverge at offset %d (got len=%d want len=%d mime=%s w=%v)", i, len(got), len(src), mime, w)
			}
		}
		t.Fatalf("length differs: got %d want %d", len(got), len(src))
	}
	_ = sha
	_ = h
}
