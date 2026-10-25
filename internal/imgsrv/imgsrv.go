// Package imgsrv 图片静态服务：/uploads/ 原图直出 + ?w= 按需缩放磁盘缓存。
//
// 背景：低带宽服务器上原图直发（单张 200~600KB）会显著拖慢列表页。
// 前端在卡片/缩略图等小尺寸展示场景请求 ?w=480 等缩放版本；
// 详情主图用 ?w=960；灯箱仍用原图。缩放结果落盘缓存，只生成一次。
//
// 安全：文件名沿用 storage 的 yyyy/mm/ULID.ext 白名单正则，防路径穿越；
// 缩放宽度仅允许白名单值；超大图（保护上限）直接回退原图。
// 范围：仅 jpeg/png 缩放（纯 Go 标准库）；webp/avif/mp4 及未知类型原样返回。
package imgsrv

import (
	"bytes"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"golang.org/x/image/draw"
)

// widthWhitelist 允许的缩放宽度（与前端展示尺寸约定一致）。
var widthWhitelist = map[int]bool{
	160: true, 320: true, 480: true, 640: true, 960: true, 1280: true,
}

// maxDecodeDim 解码保护：源图任一边超过该值不做缩放（防解压炸弹），回退原图。
const maxDecodeDim = 8000

// validName 与 storage 的安全文件名一致：yyyy/mm/ULID.ext（ext 为白名单类型）。
var validName = regexp.MustCompile(`^[0-9]{4}/[0-9]{2}/[A-Za-z0-9]{26}\.(jpg|jpeg|png|webp|avif|mp4)$`)

// Handler /uploads/ 图片服务（原图 + 按需缩放缓存）。
type Handler struct {
	baseDir   string // 上传根目录，如 ./uploads
	prefix    string // URL 前缀，如 /uploads/
	cacheDir  string // 缩放缓存根目录，如 ./data/imgcache
	cacheCtrl string // 缓存响应头
	orig      http.Handler
}

// New 构造图片服务；baseDir 不存在时返回 nil（与原 staticDirHandler 行为一致，调用方可跳过挂载）。
func New(baseDir, prefix, cacheDir, cacheControl string) *Handler {
	if st, err := os.Stat(baseDir); err != nil || !st.IsDir() {
		return nil
	}
	return &Handler{
		baseDir:   baseDir,
		prefix:    prefix,
		cacheDir:  cacheDir,
		cacheCtrl: cacheControl,
		orig:      http.StripPrefix(prefix, http.FileServer(http.Dir(baseDir))),
	}
}

func (h *Handler) setCacheHeader(w http.ResponseWriter) {
	if h.cacheCtrl != "" {
		w.Header().Set("Cache-Control", h.cacheCtrl)
	}
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimPrefix(r.URL.Path, h.prefix)
	if name == "" || strings.HasSuffix(name, "/") || strings.Contains(name, "..") {
		http.NotFound(w, r)
		return
	}
	wp := r.URL.Query().Get("w")
	if wp == "" {
		h.serveOriginal(w, r)
		return
	}
	width, err := strconv.Atoi(wp)
	if err != nil || !widthWhitelist[width] {
		h.serveOriginal(w, r) // 非法宽度宽容处理：直接回原图
		return
	}
	h.serveScaled(w, r, name, width)
}

func (h *Handler) serveOriginal(w http.ResponseWriter, r *http.Request) {
	h.setCacheHeader(w)
	h.orig.ServeHTTP(w, r)
}

// serveScaled 输出缩放版本：优先命中磁盘缓存；未命中则生成后原子写入缓存再返回。
func (h *Handler) serveScaled(w http.ResponseWriter, r *http.Request, name string, width int) {
	if !validName.MatchString(name) {
		h.serveOriginal(w, r)
		return
	}
	// 仅图片可缩放；webp/avif/mp4 原样（不引入 cgo 解码器）
	ext := strings.ToLower(filepath.Ext(name))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" {
		h.serveOriginal(w, r)
		return
	}

	srcPath := filepath.Join(h.baseDir, filepath.FromSlash(name))
	cachePath := filepath.Join(h.cacheDir, strconv.Itoa(width), filepath.FromSlash(name))

	srcSt, err := os.Stat(srcPath)
	if err != nil {
		h.serveOriginal(w, r) // 源不存在 → 走原图路径给出标准 404
		return
	}
	if st, err := os.Stat(cachePath); err == nil && !st.ModTime().Before(srcSt.ModTime()) {
		h.serveCache(w, r, cachePath, ext)
		return
	}

	body, ctype, err := h.buildScaled(srcPath, width, ext)
	if err != nil {
		// 解码失败等异常：宽容降级为原图，不把错误暴露给终端用户
		h.serveOriginal(w, r)
		return
	}

	if err := writeAtomic(cachePath, body); err == nil {
		h.serveCache(w, r, cachePath, ext)
		return
	}
	// 缓存写失败（只读盘等）：直接输出本次生成的结果
	h.setCacheHeader(w)
	w.Header().Set("Content-Type", ctype)
	w.Header().Set("Content-Length", strconv.Itoa(len(body)))
	_, _ = w.Write(body)
}

// serveCache 缓存命中/已写入后输出缓存文件（ServeFile 自带条件请求 304）。
func (h *Handler) serveCache(w http.ResponseWriter, r *http.Request, path, ext string) {
	h.setCacheHeader(w)
	w.Header().Set("Content-Type", contentType(ext))
	http.ServeFile(w, r, path)
}

// buildScaled 读取源图并生成 width 等比缩放版本，返回编码字节与 Content-Type。
func (h *Handler) buildScaled(srcPath string, width int, ext string) ([]byte, string, error) {
	f, err := os.Open(srcPath)
	if err != nil {
		return nil, "", err
	}
	defer f.Close()

	// 先探测尺寸，超大图直接放弃缩放（调用方回退原图）
	cfg, _, err := image.DecodeConfig(f)
	if err != nil {
		return nil, "", err
	}
	if cfg.Width > maxDecodeDim || cfg.Height > maxDecodeDim {
		return nil, "", fmt.Errorf("image too large: %dx%d", cfg.Width, cfg.Height)
	}
	if _, err := f.Seek(0, 0); err != nil {
		return nil, "", err
	}
	src, _, err := image.Decode(f)
	if err != nil {
		return nil, "", err
	}

	dst := scaleImage(src, width)
	var buf bytes.Buffer
	if ext == ".png" {
		if err := png.Encode(&buf, dst); err != nil {
			return nil, "", err
		}
		return buf.Bytes(), "image/png", nil
	}
	if err := jpeg.Encode(&buf, dst, &jpeg.Options{Quality: 82}); err != nil {
		return nil, "", err
	}
	return buf.Bytes(), "image/jpeg", nil
}

// scaleImage 等比缩放到 maxW 宽（仅缩小不放大），Catmull-Rom 高质量重采样。
func scaleImage(src image.Image, maxW int) image.Image {
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	if w <= maxW || w <= 0 || h <= 0 {
		return src
	}
	nh := int(float64(h) * float64(maxW) / float64(w))
	if nh < 1 {
		nh = 1
	}
	dst := image.NewRGBA(image.Rect(0, 0, maxW, nh))
	draw.CatmullRom.Scale(dst, dst.Bounds(), src, b, draw.Over, nil)
	return dst
}

// writeAtomic 临时文件 + rename 原子落盘；并发生成同一缓存时重复写无害。
func writeAtomic(path string, body []byte) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(dir, ".imgtmp-*")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	_, werr := tmp.Write(body)
	cerr := tmp.Close()
	if werr != nil || cerr != nil {
		_ = os.Remove(tmpName)
		if werr != nil {
			return werr
		}
		return cerr
	}
	return os.Rename(tmpName, path)
}

func contentType(ext string) string {
	switch ext {
	case ".png":
		return "image/png"
	default:
		return "image/jpeg"
	}
}
