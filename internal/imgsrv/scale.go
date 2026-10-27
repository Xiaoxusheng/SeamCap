package imgsrv

import (
	"image"
	"image/color"
	"math"
)

// 内存可控的 Catmull-Rom 等比缩放。
//
// 为什么不用 golang.org/x/image/draw 的 Kernel.Scale：它按 dw×sh 分配
// [4]float64 的中间缓冲（每个目标像素 32 字节），一张 1920×1440 缩到 1280 宽
// 单次就要 59MiB，2400 万像素的源图能到 120MiB 以上——1C1G 机器上单个请求
// 就能顶出几十兆尖峰，与"按需缩放缓存"的定位完全不匹配。
//
// 这里改成按行流式处理：水平方向只缓存"垂直窗口内"的源行（窗口大小由缩放
// 比例决定，通常十几行），垂直方向逐目标行累加。峰值内存 ≈ 窗口×目标宽×32B，
// 与源图高度无关；缩放核、权重归一化与原实现一致，输出质量相同。

// catmullRomSupport Catmull-Rom 核的支撑半径（x/image/draw 中 Same）。
const catmullRomSupport = 2.0

// catmullRomAt Catmull-Rom 核（B=0, C=0.5），与 x/image/draw.CatmullRom 一致。
func catmullRomAt(t float64) float64 {
	if t < 1 {
		return (1.5*t-2.5)*t*t + 1
	}
	return ((-0.5*t+2.5)*t-4)*t + 2
}

// contrib 一个源像素对目标像素的贡献。
type contrib struct {
	coord  int
	weight float64
}

// contribRange 目标像素在 contribs 中的区间与归一化系数。
type contribRange struct {
	start, end int
	invTotal   float64
}

// distrib 一维的重采样权重表（源坐标 → 目标坐标）。
type distrib struct {
	ranges   []contribRange
	contribs []contrib
}

// newDistrib 把 sw 个源像素分配到 dw 个目标像素上，权重做归一化。
func newDistrib(dw, sw int) distrib {
	scale := float64(sw) / float64(dw)
	halfWidth, argScale := catmullRomSupport, 1.0
	// 缩小时展宽核，保证每个源像素都被采样到（与 x/image/draw 的处理一致）
	if scale > 1 {
		halfWidth *= scale
		argScale = 1 / scale
	}

	bounds := make([][2]int, dw)
	total := 0
	for x := 0; x < dw; x++ {
		center := (float64(x)+0.5)*scale - 0.5
		i := int(math.Floor(center - halfWidth))
		if i < 0 {
			i = 0
		}
		j := int(math.Ceil(center + halfWidth))
		if j > sw {
			j = sw
			if j < i {
				j = i
			}
		}
		bounds[x] = [2]int{i, j}
		total += j - i
	}

	ranges := make([]contribRange, dw)
	contribs := make([]contrib, 0, total)
	for x := 0; x < dw; x++ {
		center := (float64(x)+0.5)*scale - 0.5
		start := len(contribs)
		sum := 0.0
		for coord := bounds[x][0]; coord < bounds[x][1]; coord++ {
			t := math.Abs(center-float64(coord)) * argScale
			if t >= catmullRomSupport {
				continue
			}
			w := catmullRomAt(t)
			if w == 0 {
				continue
			}
			sum += w
			contribs = append(contribs, contrib{coord: coord, weight: w})
		}
		if sum == 0 {
			// 理论上不会发生（窗口内至少有一个像素）；退化时取最近邻，避免除零
			nearest := int(math.Round(center))
			if nearest < 0 {
				nearest = 0
			}
			if nearest >= sw {
				nearest = sw - 1
			}
			contribs = append(contribs, contrib{coord: nearest, weight: 1})
			sum = 1
		}
		ranges[x] = contribRange{start: start, end: len(contribs), invTotal: 1 / sum}
	}
	return distrib{ranges: ranges, contribs: contribs}
}

// rowScaler 流式缩放器：水平结果按源行缓存在环形数组里，垂直逐行累加。
type rowScaler struct {
	src  image.Image
	srcR image.Rectangle
	dw   int
	dh   int

	horiz distrib
	vert  distrib

	window int
	rows   [][]float64
	tags   []int
	acc    []float64
}

// scaleImage 等比缩放到 maxW 宽（仅缩小不放大），返回 *image.RGBA。
func scaleImage(src image.Image, maxW int) image.Image {
	b := src.Bounds()
	sw, sh := b.Dx(), b.Dy()
	if sw <= maxW || sw <= 0 || sh <= 0 {
		return src
	}
	dh := int(float64(sh) * float64(maxW) / float64(sw))
	if dh < 1 {
		dh = 1
	}
	z := newRowScaler(src, maxW, dh)
	return z.scale()
}

func newRowScaler(src image.Image, dw, dh int) *rowScaler {
	z := &rowScaler{
		src:    src,
		srcR:   src.Bounds(),
		dw:     dw,
		dh:     dh,
		horiz:  newDistrib(dw, src.Bounds().Dx()),
		vert:   newDistrib(dh, src.Bounds().Dy()),
		acc:    make([]float64, dw*4),
		window: 1,
	}
	for _, r := range z.vert.ranges {
		if n := r.end - r.start; n > z.window {
			z.window = n
		}
	}
	z.rows = make([][]float64, z.window)
	z.tags = make([]int, z.window)
	for i := range z.tags {
		z.tags[i] = -1
	}
	return z
}

func (z *rowScaler) scale() image.Image {
	dst := image.NewRGBA(image.Rect(0, 0, z.dw, z.dh))
	for dy := 0; dy < z.dh; dy++ {
		r := z.vert.ranges[dy]
		for i := range z.acc {
			z.acc[i] = 0
		}
		for k := r.start; k < r.end; k++ {
			c := z.vert.contribs[k]
			w := c.weight * r.invTotal
			row := z.hrow(c.coord)
			for i, v := range row {
				z.acc[i] += v * w
			}
		}
		off := dst.PixOffset(0, dy)
		for x := 0; x < z.dw; x++ {
			o := x << 2
			dst.Pix[off+o+0] = to8(z.acc[o+0])
			dst.Pix[off+o+1] = to8(z.acc[o+1])
			dst.Pix[off+o+2] = to8(z.acc[o+2])
			dst.Pix[off+o+3] = to8(z.acc[o+3])
		}
	}
	return dst
}

// hrow 返回第 sy 个源行水平缩放后的结果（预乘 alpha，0..1）。
// 垂直方向的源行窗口随目标行单调前移，环形缓存只需保留最近 window 行。
// 按源图具体类型分派到专用循环：这里是整条链路最热的地方（每张图约
// 源宽×源高×核宽 次采样），避免每个像素都走一次接口类型判断。
func (z *rowScaler) hrow(sy int) []float64 {
	idx := sy % z.window
	if z.tags[idx] == sy {
		return z.rows[idx]
	}
	row := z.rows[idx]
	if row == nil {
		row = make([]float64, z.dw*4)
		z.rows[idx] = row
	} else {
		for i := range row {
			row[i] = 0
		}
	}

	y := z.srcR.Min.Y + sy
	switch im := z.src.(type) {
	case *image.YCbCr: // JPEG 解码结果，最常见
		z.rowFromYCbCr(im, y, row)
	case *image.RGBA: // 预乘 alpha
		z.rowFromRGBA(im, y, row)
	default:
		z.rowFromImage(y, row)
	}
	z.tags[idx] = sy
	return row
}

func (z *rowScaler) rowFromYCbCr(im *image.YCbCr, y int, row []float64) {
	minX, minY := im.Rect.Min.X, im.Rect.Min.Y
	yBase := (y-minY)*im.YStride - minX
	ranges, contribs := z.horiz.ranges, z.horiz.contribs
	for x := 0; x < z.dw; x++ {
		r := ranges[x]
		var r0, g0, b0 float64
		for k := r.start; k < r.end; k++ {
			c := contribs[k]
			w := c.weight * r.invTotal
			sx := minX + c.coord
			cr, cg, cb := color.YCbCrToRGB(im.Y[yBase+sx], im.Cb[im.COffset(sx, y)], im.Cr[im.COffset(sx, y)])
			r0 += float64(cr) * w
			g0 += float64(cg) * w
			b0 += float64(cb) * w
		}
		o := x << 2
		row[o+0], row[o+1], row[o+2], row[o+3] = r0/255, g0/255, b0/255, 1
	}
}

func (z *rowScaler) rowFromRGBA(im *image.RGBA, y int, row []float64) {
	ranges, contribs := z.horiz.ranges, z.horiz.contribs
	base := im.PixOffset(z.srcR.Min.X, y)
	for x := 0; x < z.dw; x++ {
		r := ranges[x]
		var r0, g0, b0, a0 float64
		for k := r.start; k < r.end; k++ {
			c := contribs[k]
			w := c.weight * r.invTotal
			p := im.Pix[base+c.coord*4:]
			r0 += float64(p[0]) * w
			g0 += float64(p[1]) * w
			b0 += float64(p[2]) * w
			a0 += float64(p[3]) * w
		}
		o := x << 2
		row[o+0], row[o+1], row[o+2], row[o+3] = r0/255, g0/255, b0/255, a0/255
	}
}

// rowFromImage 通用路径：color.Color.RGBA() 按约定返回预乘 alpha 的 16 位分量。
func (z *rowScaler) rowFromImage(y int, row []float64) {
	ranges, contribs := z.horiz.ranges, z.horiz.contribs
	for x := 0; x < z.dw; x++ {
		r := ranges[x]
		var r0, g0, b0, a0 float64
		for k := r.start; k < r.end; k++ {
			c := contribs[k]
			w := c.weight * r.invTotal
			pr, pg, pb, pa := z.src.At(z.srcR.Min.X+c.coord, y).RGBA()
			r0 += float64(pr) * w
			g0 += float64(pg) * w
			b0 += float64(pb) * w
			a0 += float64(pa) * w
		}
		o := x << 2
		row[o+0], row[o+1], row[o+2], row[o+3] = r0/0xffff, g0/0xffff, b0/0xffff, a0/0xffff
	}
}

// to8 0..1 → 0..255，四舍五入并夹紧。
func to8(v float64) uint8 {
	n := v*255 + 0.5
	if n <= 0 {
		return 0
	}
	if n >= 255 {
		return 255
	}
	return uint8(n)
}
