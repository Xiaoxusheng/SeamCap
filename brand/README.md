# SHIRUN HAT · 品牌标识文件

无痕帽制造与出口品牌（Seamless Hat Manufacturer & Exporter）的标识资产。
所有文件均为**纯矢量、文字已转曲**，不依赖任何字体，可在 Illustrator / Figma / CorelDRAW 直接编辑。

完整规范见 [`brand-sheet.html`](brand-sheet.html)（单文件，可直接发给设计或印刷厂）。

---

## 1. 色值

| 名称 | HEX | RGB | 用途 |
|---|---|---|---|
| Shirun Navy | `#06294F` | 6 · 41 · 79 | 主色 |
| Cap Orange | `#FA8100` | 250 · 129 · 0 | 强调（仅帽檐，占比 ≤10%） |
| Ink | `#0E1B2A` | 14 · 27 · 42 | 正文文字 |

---

## 2. 文件

### `logo/` — 矢量源文件

| 文件 | 用途 |
|---|---|
| `shirun-hat-logo-primary.svg` | 主标识（帽标 + 字标 + 标语 + 双线），目录封面、形式发票抬头 |
| `shirun-hat-logo-horizontal.svg` | 横向组合，网站页眉、邮件签名 |
| `shirun-hat-logo-stacked.svg` | 竖向组合，社媒封面、展板 |
| `shirun-hat-mark.svg` | 纯图形，头像、吊牌、绣标 |
| `shirun-hat-logo-primary-mono.svg` | 单色版（全深蓝），单色印刷 |
| `shirun-hat-logo-primary-reversed.svg` | 反白版，深底使用 |
| `shirun-hat-logo-horizontal-reversed.svg` | 横向反白版 |
| `shirun-hat-logo-primary-with-r.svg` | 带 ® 版本（**商标注册核准前请勿使用**） |
| `favicon.svg` | 站点图标（深蓝圆角底 + 反白帽标） |

### `png/` — 透明背景位图（无水印）

- `shirun-hat-logo-primary@3000.png` / `@1500.png`
- `shirun-hat-logo-horizontal@2400.png` / `@1200.png`
- `shirun-hat-logo-stacked@1800.png`
- `shirun-hat-mark@1024.png` / `@512.png` / `@256.png` / `@128.png`
- `shirun-hat-logo-primary-mono@2000.png`
- `shirun-hat-logo-primary-reversed@2000.png`
- `shirun-hat-logo-horizontal-reversed@2400.png`
- `favicon-32.png` / `-180.png` / `-512.png`

---

## 3. 使用规则

- **最小尺寸**：横版 ≥ 120px 宽（印刷 ≥ 28mm）；纯图形 ≥ 24px 高，小于此尺寸只用图形。
- **清空区**：四周留白 ≥ 字标大写字母高度的 0.5 倍，不得有文字、图片或边框进入。
- **不可改动**：不拉伸、不倾斜、不加描边/阴影、不换色、不把橙色用在帽冠或字母上。
- **底色**：浅底用彩色版，深底用反白版；禁止压在照片或渐变上，必须压时先铺 90% 深蓝蒙版。
- **® 符号**：仅在中国或目标市场取得商标注册后使用。未注册而标注 ® 在美国属 "false marking"，有法律风险。

---

## 4. 重新生成

```bash
# 需要 Python 3.11+ 与 Node 22（仅用于渲染 PNG）
pip install fonttools uharfbuzz
python _build/build.py    # 重新输出 logo/*.svg
node   _build/export.js   # 重新输出 png/*.png
python _build/sheet.py    # 重新生成 brand-sheet.html
```

- `_build/gen.py` — 帽子图形的几何定义（帽檐贝塞尔 + 帽冠椭圆 + 接缝）
- `_build/build.py` — 各锁定组合的排版参数（字距、间距、边距）
- 字标使用 Archivo 800（SIL Open Font License），标语使用 Inter 600

调整比例只需改 `build.py` 顶部的 `H`（字标大写高度）、`GAP`（SHIRUN 与 HAT 间距）、
`build_primary()` 里的 `mw = 576.0`（帽标宽度）。
