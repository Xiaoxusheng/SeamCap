package imgsrv

import (
	"image"
	"image/color"
	"testing"

	"golang.org/x/image/draw"
)

// gradientImage 生成带渐变与半透明区域的测试图（覆盖预乘 alpha 路径）。
func gradientImage(w, h int) *image.NRGBA {
	img := image.NewNRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.SetNRGBA(x, y, color.NRGBA{
				R: uint8((x * 255) / maxInt(w-1, 1)),
				G: uint8((y * 255) / maxInt(h-1, 1)),
				B: uint8((x ^ y) & 0xff),
				A: uint8(64 + (x*3+y*5)%192),
			})
		}
	}
	return img
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// 与 x/image/draw 的 CatmullRom 输出对齐（容差 2/255，差异仅来自取整）。
func TestScaleMatchesReference(t *testing.T) {
	cases := []struct{ sw, sh, dw int }{
		{97, 61, 64},
		{97, 61, 33},
		{120, 90, 20},
		{64, 48, 63},
	}
	for _, c := range cases {
		src := gradientImage(c.sw, c.sh)
		got := scaleImage(src, c.dw)
		gb := got.Bounds()
		if gb.Dx() != c.dw {
			t.Fatalf("width = %d, want %d", gb.Dx(), c.dw)
		}
		wantH := int(float64(c.sh) * float64(c.dw) / float64(c.sw))
		if gb.Dy() != wantH {
			t.Fatalf("height = %d, want %d", gb.Dy(), wantH)
		}

		ref := image.NewRGBA(image.Rect(0, 0, gb.Dx(), gb.Dy()))
		draw.CatmullRom.Scale(ref, ref.Bounds(), src, src.Bounds(), draw.Src, nil)

		gotRGBA := got.(*image.RGBA)
		maxDiff := 0
		for y := 0; y < gb.Dy(); y++ {
			for x := 0; x < gb.Dx(); x++ {
				gi := gotRGBA.PixOffset(x, y)
				ri := ref.PixOffset(x, y)
				for k := 0; k < 4; k++ {
					d := int(gotRGBA.Pix[gi+k]) - int(ref.Pix[ri+k])
					if d < 0 {
						d = -d
					}
					if d > maxDiff {
						maxDiff = d
					}
				}
			}
		}
		if maxDiff > 2 {
			t.Fatalf("%dx%d -> %d: max channel diff = %d (>2)", c.sw, c.sh, c.dw, maxDiff)
		}
	}
}

// 环形缓存的容量必须只与"垂直窗口"有关，不能随源图高度线性增长。
func TestScaleTempBufferBounded(t *testing.T) {
	src := image.NewYCbCr(image.Rect(0, 0, 1920, 1440), image.YCbCrSubsampleRatio420)
	z := newRowScaler(src, 1280, 960)
	bytes := float64(z.window*z.dw*4*8) / (1 << 20)
	if bytes > 4 {
		t.Fatalf("row cache = %.1f MiB (window=%d), want <= 4 MiB", bytes, z.window)
	}
	// 对照：x/image/draw 同参数按 dw×sh×32B 分配临时缓冲
	if want := float64(1280*1440*32) / (1 << 20); want < 50 {
		t.Fatalf("reference estimate changed: %.1f MiB", want)
	}
}

func BenchmarkScaleImage(b *testing.B) {
	src := image.NewYCbCr(image.Rect(0, 0, 1920, 1440), image.YCbCrSubsampleRatio420)
	for i := range src.Y {
		src.Y[i] = uint8(i * 7)
	}
	for i := range src.Cb {
		src.Cb[i] = uint8(i * 3)
		src.Cr[i] = uint8(i * 5)
	}
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = scaleImage(src, 1280)
	}
}

func BenchmarkScaleReference(b *testing.B) {
	src := image.NewYCbCr(image.Rect(0, 0, 1920, 1440), image.YCbCrSubsampleRatio420)
	for i := range src.Y {
		src.Y[i] = uint8(i * 7)
	}
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		dst := image.NewRGBA(image.Rect(0, 0, 1280, 960))
		draw.CatmullRom.Scale(dst, dst.Bounds(), src, src.Bounds(), draw.Src, nil)
	}
}
