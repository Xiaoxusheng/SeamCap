package service

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http/httptest"
	"os"
	"testing"

	"seamcap/internal/storage"
)

// 完整复现：客户端 multipart 编码 → 服务端 ParseMultipartForm → Media.Upload
func TestUploadViaMultipartByteExact(t *testing.T) {
	env := newSvcEnv(t)
	src, err := os.ReadFile("../../web/static/img/cap-image-23.jpg")
	if err != nil {
		t.Skip("source not available:", err)
	}

	// 模拟客户端：multipart 编码
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	fw, _ := mw.CreateFormFile("file", "cap-image-23.jpg")
	fw.Write(src)
	mw.Close()

	// 模拟服务端：构造请求 → ParseMultipartForm → FormFile
	req := httptest.NewRequest("POST", "/api/v1/admin/media", bytes.NewReader(body.Bytes()))
	req.Header.Set("Content-Type", mw.FormDataContentType())
	if err := req.ParseMultipartForm(32 << 20); err != nil {
		t.Fatal(err)
	}
	file, _, err := req.FormFile("file")
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()

	// 统计 multipart.File 实际内容长度
	fc, err := io.ReadAll(file)
	if err != nil {
		t.Fatal(err)
	}
	if len(fc) != len(src) {
		t.Fatalf("multipart part content = %d bytes, want %d (client/server multipart layer doubles!)", len(fc), len(src))
	}

	m, err := env.Media.Upload("cap-image-23.jpg", bytes.NewReader(fc), "")
	if err != nil {
		t.Fatalf("upload: %v", err)
	}
	if m.SizeBytes != int64(len(src)) {
		t.Errorf("size_bytes = %d, want %d", m.SizeBytes, len(src))
	}
	ls, ok := env.Store.(*storage.LocalStorage)
	if !ok {
		t.Fatal("store is not LocalStorage")
	}
	abs, err := ls.AbsPathForTest(m.Filename)
	if err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(abs)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, src) {
		t.Fatalf("written file differs (got %d bytes, want %d)", len(got), len(src))
	}
}
