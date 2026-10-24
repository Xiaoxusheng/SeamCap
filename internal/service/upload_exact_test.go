package service

import (
	"bytes"
	"os"
	"testing"
)

// 复刻真实上传链路（sniffAndLimit → store.Save）的字节精确性测试
func TestUploadByteExactRealJPEG(t *testing.T) {
	env := newSvcEnv(t)
	src, err := os.ReadFile("../../web/static/img/cap-image-23.jpg")
	if err != nil {
		t.Skip("source not available:", err)
	}
	m, err := env.Media.Upload("cap-image-23.jpg", bytes.NewReader(src), "")
	if err != nil {
		t.Fatalf("upload: %v", err)
	}
	if m.SizeBytes != int64(len(src)) {
		t.Errorf("size_bytes = %d, want %d", m.SizeBytes, len(src))
	}
	// 读回落盘文件
	abs, err := env.Store.(interface {
		AbsPathForTest(filename string) (string, error)
	}).AbsPathForTest(m.Filename)
	if err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(abs)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, src) {
		n := len(got)
		if len(src) < n {
			n = len(src)
		}
		for i := 0; i < n; i++ {
			if got[i] != src[i] {
				t.Fatalf("written file diverges at offset %d: got len=%d want len=%d", i, len(got), len(src))
			}
		}
		t.Fatalf("written file length differs: got %d want %d", len(got), len(src))
	}
}
