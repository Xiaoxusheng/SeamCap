"""把品牌资产接入 web 站点：生成深浅两套页眉标识，并输出管理端用的路径数据"""
import os, re, json, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build
from gen import NAVY, ORANGE

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
WEB = os.path.join(ROOT, "web")
BRAND_DIR = os.path.join(WEB, "static", "img", "brand")
os.makedirs(BRAND_DIR, exist_ok=True)

IVORY = "#F5F1EA"   # 站点深色主题的强调文字色

# 1) 页眉横版：深底用象牙白，浅底用品牌深蓝；橙色帽檐在两套里都保留
dark = build.build_horizontal(navy=IVORY, orange=ORANGE, mark_kw=build.FINAL_MARK)
light = build.build_horizontal(navy=NAVY, orange=ORANGE, mark_kw=build.FINAL_MARK)
open(os.path.join(BRAND_DIR, "logo-on-dark.svg"), "w", encoding="utf-8").write(build.compact(dark))
open(os.path.join(BRAND_DIR, "logo-on-light.svg"), "w", encoding="utf-8").write(build.compact(light))

# 2) 纯图形两套（管理端 / 分享图）
md = build.build_mark(navy=IVORY, orange=ORANGE, mark_kw=build.FINAL_MARK)
ml = build.build_mark(navy=NAVY, orange=ORANGE, mark_kw=build.FINAL_MARK)
open(os.path.join(BRAND_DIR, "mark-on-dark.svg"), "w", encoding="utf-8").write(build.compact(md))
open(os.path.join(BRAND_DIR, "mark-on-light.svg"), "w", encoding="utf-8").write(build.compact(ml))

# 3) favicon 覆盖站点旧图标
fav = os.path.join(ROOT, "brand", "logo", "favicon.svg")
open(os.path.join(WEB, "static", "img", "favicon.svg"), "w", encoding="utf-8").write(
    open(fav, encoding="utf-8").read())

# 4) 抽取帽子图形路径，供 React 组件内联
svg = open(os.path.join(ROOT, "brand", "logo", "shirun-hat-mark.svg"), encoding="utf-8").read()
paths = re.findall(r"<path[^/]*?/>", svg)
out = []
for p in paths:
    d = re.search(r'd="([^"]+)"', p).group(1)
    stroke = re.search(r'stroke="([^"]+)"', p)
    sw = re.search(r'stroke-width="([\d.]+)"', p)
    fill = re.search(r'fill="([^"]+)"', p)
    out.append({
        "d": d,
        "role": "stroke" if stroke else "fill",
        "sw": float(sw.group(1)) if sw else None,
        "fill": fill.group(1) if fill else None,
    })
g = re.search(r'<g transform="([^"]+)"', svg).group(1)
json.dump({"transform": g, "paths": out},
          open(os.path.join(os.path.dirname(__file__), "mark_paths.json"), "w"), ensure_ascii=False)
print("brand assets ->", BRAND_DIR)
for f in sorted(os.listdir(BRAND_DIR)):
    print("  ", f, os.path.getsize(os.path.join(BRAND_DIR, f)), "bytes")
print("mark paths:", len(out), "roles:", [p["role"] for p in out])
