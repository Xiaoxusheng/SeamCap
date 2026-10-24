package storage

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"hash"
	"image"
	"io"
	"os"
	"sync"
	"time"

	_ "image/jpeg" // 注册解码器（读尺寸用）
	_ "image/png"
)

// SniffLen 嗅探所需的最大头部字节数（覆盖 ftyp box）。
const SniffLen = 32

// DetectMime 通过文件头 magic number 判断真实类型（不信任扩展名）。
// 白名单：image/jpeg, image/png, image/webp, image/avif, video/mp4。
// 返回 mime、规范扩展名、是否白名单命中。
func DetectMime(head []byte) (mimeType, ext string, ok bool) {
	if len(head) >= 3 && head[0] == 0xFF && head[1] == 0xD8 && head[2] == 0xFF {
		return "image/jpeg", "jpg", true
	}
	if len(head) >= 8 {
		if head[0] == 0x89 && head[1] == 0x50 && head[2] == 0x4E && head[3] == 0x47 &&
			head[4] == 0x0D && head[5] == 0x0A && head[6] == 0x1A && head[7] == 0x0A {
			return "image/png", "png", true
		}
	}
	// WebP: "RIFF" + 4字节长度 + "WEBP"
	if len(head) >= 12 && string(head[0:4]) == "RIFF" && string(head[8:12]) == "WEBP" {
		return "image/webp", "webp", true
	}
	// MP4/AVIF/HEIC: ISO BMFF，第 4-8 字节为 "ftyp"，第 8-12 字节为 brand
	if len(head) >= 12 && string(head[4:8]) == "ftyp" {
		brand := string(head[8:12])
		switch brand {
		case "avif", "avis", "mif1":
			return "image/avif", "avif", true
		case "isom", "iso2", "avc1", "mp41", "mp42", "dash", "msdh", "msix", "mmp4", "M4V ", "M4A ":
			return "video/mp4", "mp4", true
		default:
			return "", "", false // heic/hevc 等不在白名单
		}
	}
	return "", "", false
}

// ---- 流式写盘：限大小 + 计算 SHA-256 + 图片尺寸 ----

// writeStream 把 head+rest 写入 path，超过 sizeLimit 报 SizeLimitError。
// 同时计算 SHA-256 与（可能的）图片宽高。失败时由调用方清理半成品。
func writeStream(head []byte, rest io.Reader, path string, sizeLimit int64, mimeType string) (int64, string, *int, *int, error) {
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644)
	if err != nil {
		return 0, "", nil, nil, err
	}
	defer f.Close()

	digest := sha256.New()
	cw := &countingHashWriter{w: f, h: digest}

	full := io.MultiReader(bytes.NewReader(head), rest)
	limited := io.LimitReader(full, sizeLimit+1) // 多读 1 字节用于判断超限

	// 图片尺寸探测：先把头部读入内存单独解析，再原样写盘。
	// 不能用 io.TeeReader(limited, cw) 再 io.Copy(cw, tee)：那会把同一批字节写两次。
	var width, height *int
	if mimeType == "image/jpeg" || mimeType == "image/png" {
		prefix := make([]byte, 64<<10) // 覆盖所有常见图片头（含较大 EXIF）
		n, rerr := io.ReadFull(limited, prefix)
		if rerr != nil && rerr != io.EOF && rerr != io.ErrUnexpectedEOF {
			return 0, "", nil, nil, rerr
		}
		prefix = prefix[:n]
		if w, h, derr := decodeDimensions(bytes.NewReader(prefix)); derr == nil {
			width, height = w, h
		}
		if _, werr := cw.Write(prefix); werr != nil {
			return 0, "", nil, nil, werr
		}
	}
	if _, err := io.Copy(cw, limited); err != nil {
		return 0, "", nil, nil, err
	}
	if cw.count > sizeLimit {
		return 0, "", nil, nil, &SizeLimitError{Limit: sizeLimit}
	}
	if cw.count == 0 {
		return 0, "", nil, nil, ErrEmptyFile
	}
	return cw.count, hex.EncodeToString(digest.Sum(nil)), width, height, nil
}

// countingHashWriter 边写边计数并计算哈希。
type countingHashWriter struct {
	w     io.Writer
	h     hash.Hash
	count int64
}

func (c *countingHashWriter) Write(p []byte) (int, error) {
	n, err := c.w.Write(p)
	c.h.Write(p[:n])
	c.count += int64(n)
	return n, err
}

// SizeLimitError 超限错误（service 层映射为 413）。
type SizeLimitError struct{ Limit int64 }

func (e *SizeLimitError) Error() string { return "file exceeds size limit" }

// ErrEmptyFile 空文件错误。
var ErrEmptyFile = errEmpty{}

type errEmpty struct{}

func (errEmpty) Error() string { return "empty file" }

// decodeDimensions 读取 JPEG/PNG 尺寸（不校验整图合法性）。
func decodeDimensions(r io.Reader) (*int, *int, error) {
	cfg, _, err := image.DecodeConfig(r)
	if err != nil {
		return nil, nil, err
	}
	return &cfg.Width, &cfg.Height, nil
}

// ---- ULID 生成（Crockford Base32，26 字符，无外部依赖） ----

const ulidEncoding = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

var ulidMu sync.Mutex
var lastULID [16]byte

// NewFilename 生成 {yyyy}/{mm}/{ULID}.{ext} 存储文件名。
func NewFilename(ext string) string {
	return time.Now().UTC().Format("2006/01") + "/" + NewULID() + "." + ext
}

// NewULID 生成 48 位毫秒时间戳 + 80 位随机数的 ULID（同毫秒内单调递增）。
func NewULID() string {
	ulidMu.Lock()
	defer ulidMu.Unlock()

	var id [16]byte
	ms := uint64(time.Now().UTC().UnixMilli())
	id[0] = byte(ms >> 40)
	id[1] = byte(ms >> 32)
	id[2] = byte(ms >> 24)
	id[3] = byte(ms >> 16)
	id[4] = byte(ms >> 8)
	id[5] = byte(ms)

	if id == lastULID { // 同毫秒碰撞：随机位 +1 保证单调
		for i := 15; i >= 6; i-- {
			id[i]++
			if id[i] != 0 {
				break
			}
		}
	} else {
		if _, err := rand.Read(id[6:]); err != nil {
			panic("crypto/rand unavailable: " + err.Error())
		}
	}
	lastULID = id
	return encodeULID(id)
}

// encodeULID 128bit → 26 个 Crockford Base32 字符（首字符 3bit，其余 5bit/字符）。
func encodeULID(id [16]byte) string {
	var buf [17]byte // 130bit 左补 2 个零位后右对齐
	buf[1] = id[0]
	copy(buf[2:], id[1:])

	var out [26]byte
	for i := 0; i < 26; i++ {
		bit := i * 5
		k := bit / 8
		word := uint16(buf[k])<<8 | uint16(buf[k+1])
		out[i] = ulidEncoding[(word>>(11-bit%8))&31]
	}
	return string(out[:])
}
