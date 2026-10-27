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
	"runtime"
	"strconv"
	"strings"
	"sync"
)

// widthWhitelist 允许的缩放宽度（与前端展示尺寸约定一致）。
var widthWhitelist = map[int]bool{
	160: true, 320: true, 480: true, 640: true, 960: true, 1280: true,
}

// 解码保护：单边或总像素超限的源图不做缩放（防解压炸弹），回退原图。
// 24MP 按最坏情况（PNG 解码为 RGBA，每像素 4 字节）约 96MiB，
// 再乘并发上限就是可预估的峰值，不会像原来那样出现无界尖峰。
const (
	maxDecodeDim    = 6000
	maxDecodePixels = 24_000_000
)

// validName 与 storage 的安全文件名一致：yyyy/mm/ULID.ext（ext 为白名单类型）。
var validName = regexp.MustCompile(`^[0-9]{4}/[0-9]{2}/[A-Za-z0-9]{26}\.(jpg|jpeg|png|webp|avif|mp4)$`)

// Handler /uploads/ 图片服务（原图 + 按需缩放缓存）。
type Handler struct {
	baseDir   string // 上传根目录，如 ./uploads
	prefix    string // URL 前缀，如 /uploads/
	cacheDir  string // 缩放缓存根目录，如 ./data/imgcache
	cacheCtrl string // 缓存响应头
	orig      http.Handler

	// sem 限制同时进行的"解码 + 缩放"数量：单次操作的工作集是整张源图，
	// 并发放大会直接把 RSS 顶上去（1C1G 机器上尤其危险）。
	sem chan struct{}
	// locks 按缓存路径分片：同一张图同一宽度并发首次请求时只生成一次，
	// 其余请求等待后直接读缓存，省掉重复解码与重复内存占用。
	locks [32]sync.Mutex
}

// New 构造图片服务；baseDir 不存在时返回 nil（与原 staticDirHandler 行为一致，调用方可跳过挂载）。
func New(baseDir, prefix, cacheDir, cacheControl string) *Handler {
	if st, err := os.Stat(baseDir); err != nil || !st.IsDir() {
		return nil
	}
	// 并发上限跟随 CPU：1 核机器上并行解码只会互相抢核，2 路足够覆盖首屏小图。
	parallel := runtime.GOMAXPROCS(0)
	if parallel < 2 {
		parallel = 2
	}
	if parallel > 4 {
		parallel = 4
	}
	return &Handler{
		baseDir:   baseDir,
		prefix:    prefix,
		cacheDir:  cacheDir,
		cacheCtrl: cacheControl,
		orig:      http.StripPrefix(prefix, http.FileServer(http.Dir(baseDir))),
		sem:       make(chan struct{}, parallel),
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
	if h.cacheFresh(cachePath, srcSt) {
		h.serveCache(w, r, cachePath, ext)
		return
	}

	// 首次生成：同一 (文件, 宽度) 只允许一个 goroutine 解码，其余等待后命中缓存。
	// 锁只覆盖"生成 + 落盘"，不覆盖响应写出——慢客户端不应该拖住同分片的其他图片。
	mu := h.lockFor(cachePath)
	mu.Lock()
	if h.cacheFresh(cachePath, srcSt) {
		mu.Unlock()
		h.serveCache(w, r, cachePath, ext)
		return
	}
	body, ctype, err := h.buildScaled(srcPath, width, ext)
	cached := err == nil && writeAtomic(cachePath, body) == nil
	mu.Unlock()

	switch {
	case cached:
		h.serveCache(w, r, cachePath, ext)
	case err != nil:
		// 解码失败等异常：宽容降级为原图，不把错误暴露给终端用户
		h.serveOriginal(w, r)
	default:
		// 缓存写失败（只读盘等）：直接输出本次生成的结果
		h.setCacheHeader(w)
		w.Header().Set("Content-Type", ctype)
		w.Header().Set("Content-Length", strconv.Itoa(len(body)))
		_, _ = w.Write(body)
	}
}

// cacheFresh 缓存文件存在且不早于源图（源图被替换后自动失效）。
func (h *Handler) cacheFresh(cachePath string, srcSt os.FileInfo) bool {
	st, err := os.Stat(cachePath)
	return err == nil && !st.ModTime().Before(srcSt.ModTime())
}

// lockFor 按 key 取分片锁（无分配、固定的 32 个槽位，不会随缓存文件数增长）。
func (h *Handler) lockFor(key string) *sync.Mutex {
	var sum uint32
	for i := 0; i < len(key); i++ {
		sum = sum*31 + uint32(key[i])
	}
	return &h.locks[sum%uint32(len(h.locks))]
}

// serveCache 缓存命中/已写入后输出缓存文件（ServeFile 自带条件请求 304）。
func (h *Handler) serveCache(w http.ResponseWriter, r *http.Request, path, ext string) {
	h.setCacheHeader(w)
	w.Header().Set("Content-Type", contentType(ext))
	http.ServeFile(w, r, path)
}

// buildScaled 读取源图并生成 width 等比缩放版本，返回编码字节与 Content-Type。
// 通过 h.sem 限制并发：解码 + 缩放是整条链路上最大的瞬时内存来源。
func (h *Handler) buildScaled(srcPath string, width int, ext string) ([]byte, string, error) {
	h.sem <- struct{}{}
	defer func() { <-h.sem }()

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
	if cfg.Width > maxDecodeDim || cfg.Height > maxDecodeDim || cfg.Width*cfg.Height > maxDecodePixels {
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
