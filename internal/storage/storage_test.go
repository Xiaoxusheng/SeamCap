package storage

import (
	"bytes"
	"crypto/rand"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

func pngBytes(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for x := 0; x < w; x++ {
		for y := 0; h > y; y++ {
			img.Set(x, y, color.RGBA{uint8(x), uint8(y), 128, 255})
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func TestDetectMime(t *testing.T) {
	cases := []struct {
		name string
		head []byte
		mime string
		ok   bool
	}{
		{"jpeg", []byte{0xFF, 0xD8, 0xFF, 0xE0, 0x00}, "image/jpeg", true},
		{"png", append([]byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}, make([]byte, 8)...), "image/png", true},
		{"webp", append([]byte("RIFF\x00\x00\x00\x00WEBPVP8 "), make([]byte, 8)...), "image/webp", true},
		{"mp4", append([]byte("\x00\x00\x00\x18ftypisom\x00\x00\x02\x00"), make([]byte, 8)...), "video/mp4", true},
		{"avif", append([]byte("\x00\x00\x00\x18ftypavif\x00\x00\x00\x00"), make([]byte, 8)...), "image/avif", true},
		{"heic rejected", append([]byte("\x00\x00\x00\x18ftypheic\x00\x00\x00\x00"), make([]byte, 8)...), "", false},
		{"text rejected", []byte("hello world, this is text"), "", false},
		{"empty", nil, "", false},
	}
	for _, c := range cases {
		mime, _, ok := DetectMime(c.head)
		if ok != c.ok || (ok && mime != c.mime) {
			t.Errorf("%s: got (%q,%v), want (%q,%v)", c.name, mime, ok, c.mime, c.ok)
		}
	}
}

func TestSaveImageAndLimits(t *testing.T) {
	dir := t.TempDir()
	s, err := NewLocalStorage(dir)
	if err != nil {
		t.Fatal(err)
	}
	data := pngBytes(t, 40, 30)

	// 正常保存：尺寸/哈希/路径格式
	filename, size, sha, mime, w, h, err := s.Save(bytes.NewReader(data), 1<<20)
	if err != nil {
		t.Fatalf("save: %v", err)
	}
	if mime != "image/png" || w == nil || *w != 40 || h == nil || *h != 30 {
		t.Errorf("metadata wrong: mime=%s w=%v h=%v", mime, w, h)
	}
	if size != int64(len(data)) || len(sha) != 64 {
		t.Errorf("size=%d sha len=%d", size, len(sha))
	}
	if !regexp.MustCompile(`^\d{4}/\d{2}/[0-9A-Z]{26}\.png$`).MatchString(filename) {
		t.Errorf("bad filename format: %q", filename)
	}
	// URL 与落盘位置
	if s.URL(filename) != "/uploads/"+filename {
		t.Errorf("url mismatch: %s", s.URL(filename))
	}

	// 二次保存同内容 → 同 sha
	_, _, sha2, _, _, _, err := s.Save(bytes.NewReader(data), 1<<20)
	if err != nil || sha2 != sha {
		t.Errorf("same content should produce same sha: %q vs %q (%v)", sha, sha2, err)
	}

	// 超限：limit=10 字节 → SizeLimitError
	_, _, _, _, _, _, err = s.Save(bytes.NewReader(data), 10)
	if err == nil {
		t.Fatal("expected size limit error")
	}
	if _, ok := err.(*SizeLimitError); !ok {
		t.Errorf("want SizeLimitError, got %T: %v", err, err)
	}

	// 文本文件拒绝
	_, _, _, _, _, _, err = s.Save(strings.NewReader("just text"), 1<<20)
	if err == nil || !strings.Contains(err.Error(), "unsupported") {
		t.Errorf("text should be rejected, got %v", err)
	}
}

// 回归：大于 bufio 缓冲(4096) 的真实图片必须逐字节落盘，不能被重复写入。
func TestSaveLargeImageIntegrity(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 300, 300))
	noise := make([]byte, 300*300*4)
	if _, err := rand.Read(noise); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 300*300; i++ {
		img.Set(i%300, i/300, color.RGBA{noise[i*4], noise[i*4+1], noise[i*4+2], 255})
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	data := buf.Bytes()
	if len(data) <= 4096 {
		t.Fatalf("fixture too small to cover bufio buffer: %d", len(data))
	}

	dir := t.TempDir()
	s, err := NewLocalStorage(dir)
	if err != nil {
		t.Fatal(err)
	}
	filename, size, _, mime, w, h, err := s.Save(bytes.NewReader(data), 1<<20)
	if err != nil {
		t.Fatalf("save: %v", err)
	}
	if size != int64(len(data)) {
		t.Errorf("size = %d, want %d", size, len(data))
	}
	if mime != "image/png" || w == nil || *w != 300 || h == nil || *h != 300 {
		t.Errorf("metadata wrong: mime=%s w=%v h=%v", mime, w, h)
	}
	saved, err := os.ReadFile(filepath.Join(dir, filepath.FromSlash(filename)))
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(saved, data) {
		t.Errorf("saved content differs: on-disk=%d bytes, input=%d bytes", len(saved), len(data))
	}
	if _, _, err := image.DecodeConfig(bytes.NewReader(saved)); err != nil {
		t.Errorf("saved file is not a readable image: %v", err)
	}
}

func TestDeleteIdempotent(t *testing.T) {
	dir := t.TempDir()
	s, _ := NewLocalStorage(dir)
	f1, _, _, _, _, _, err := s.Save(bytes.NewReader(pngBytes(t, 4, 4)), 1<<20)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Delete(f1); err != nil {
		t.Errorf("delete: %v", err)
	}
	if err := s.Delete(f1); err != nil { // 幂等
		t.Errorf("second delete should be nil, got %v", err)
	}
}

func TestPathTraversalProtection(t *testing.T) {
	dir := t.TempDir()
	s, _ := NewLocalStorage(dir)
	for _, bad := range []string{
		"../evil.png",
		"2026/10/../../evil.png",
		"abs/path/AAAAAAAAAAAAAAAAAAAAAAAAAA.png",
		"2026/10/short.png",
		"2026/10/AAAAAAAAAAAAAAAAAAAAAAAAAA.exe",
		"",
	} {
		if err := s.Delete(bad); err == nil {
			t.Errorf("Delete(%q) should fail validation", bad)
		}
	}
	// 合法但不存在 → nil（幂等）
	good := "2026/10/" + strings.Repeat("A", 26) + ".png"
	if err := s.Delete(good); err != nil {
		t.Errorf("Delete(valid-nonexist) = %v, want nil", err)
	}
}

func TestULIDFormat(t *testing.T) {
	var ulidRe = regexp.MustCompile(`^[0-9A-HJKMNP-TV-Z]{26}$`)
	seen := map[string]bool{}
	for i := 0; i < 1000; i++ {
		id := NewULID()
		if !ulidRe.MatchString(id) {
			t.Fatalf("bad ULID: %q", id)
		}
		if seen[id] {
			t.Fatalf("duplicate ULID: %s", id)
		}
		seen[id] = true
	}
}
