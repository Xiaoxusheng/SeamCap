"""生成 SHIRUN HAT 全部 Logo 文件"""
import os, re
from gen import (NAVY, ORANGE, WORD_TTF, TAG_TTF, text_run, mark_svg,
                 MARK_W, MARK_H)

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "logo"))
os.makedirs(OUT, exist_ok=True)

TAGLINE = "SEAMLESS HAT MANUFACTURER & EXPORTER"
H = 100.0                      # 字标大写字母高度
CAP = 0.687                    # Archivo 800 cap height / em
SIZE = H / CAP
TRACK = -0.018                 # 字标字距（em）
GAP = 0.34 * H                 # SHIRUN 与 HAT 的间隔
MPAD = 7.0                     # 帽子图形描边外扩量
BOX_W = MARK_W + 2 * MPAD
BOX_H = MARK_H + 2 * MPAD
WORD_W = 913.0


def measure(text, size, font, track):
    _, w, bb = text_run(text, font, size, track)
    return w, bb


def place_mark(x, y, vis_w, navy=NAVY, orange=ORANGE, **kw):
    """按含描边的可视宽度放置帽子图形"""
    s = vis_w / BOX_W
    g = mark_svg(fill_navy=navy, fill_orange=orange, scale=s,
                 dx=x + MPAD * s, dy=y + MPAD * s, **kw)
    return g, BOX_W * s, BOX_H * s


def svg(w, h, body, bg=False):
    rect = f'<rect width="{w:.2f}" height="{h:.2f}" fill="#fff"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.2f} {h:.2f}" '
            f'width="{w:.2f}" height="{h:.2f}">' + rect + body + "</svg>")


def wordmark(x0, baseline, color=NAVY):
    w1, _ = measure("SHIRUN", SIZE, WORD_TTF, TRACK)
    w2, _ = measure("HAT", SIZE, WORD_TTF, TRACK)
    d1, _, _ = text_run("SHIRUN", WORD_TTF, SIZE, TRACK, x0, baseline)
    d2, _, _ = text_run("HAT", WORD_TTF, SIZE, TRACK, x0 + w1 + GAP, baseline)
    return (f'<path d="{d1}" fill="{color}"/><path d="{d2}" fill="{color}"/>',
            w1 + GAP + w2)


def tagline_block(cx, cy, color=NAVY, rule=True):
    size, track = 21.0, 0.15
    w, bb = measure(TAGLINE, size, TAG_TTF, track)
    baseline = cy + (bb[3] - bb[1]) / 2
    x0 = cx - w / 2
    d, _, _ = text_run(TAGLINE, TAG_TTF, size, track, x0, baseline)
    els = [f'<path d="{d}" fill="{color}"/>']
    if rule:
        rl, gapx, sw = 96.0, 30.0, 2.4
        els.insert(0, f'<path d="M {x0 - gapx - rl:.1f} {cy:.1f} H {x0 - gapx:.1f}" '
                      f'stroke="{color}" stroke-width="{sw}" stroke-linecap="round"/>')
        els.append(f'<path d="M {x0 + w + gapx:.1f} {cy:.1f} H {x0 + w + gapx + rl:.1f}" '
                   f'stroke="{color}" stroke-width="{sw}" stroke-linecap="round"/>')
    return "".join(els)


def reg_mark(x, y, size=26, color=NAVY):
    d, _, _ = text_run("®", TAG_TTF, size, 0, x, y)
    return f'<path d="{d}" fill="{color}"/>'


# ---------------- 1. 主锁定组合 ----------------
def build_primary(navy=NAVY, orange=ORANGE, with_r=False, tagline=True, mark_kw=None):
    W = 1000.0
    mw = 576.0
    m, mw, mh = place_mark((W - mw) / 2, 0, mw, navy, orange, **(mark_kw or {}))
    baseline = mh + 40 + H
    x0 = (W - WORD_W) / 2
    body = [m, wordmark(x0, baseline, navy)[0]]
    bottom = baseline
    if with_r:
        body.append(reg_mark(x0 + WORD_W + 18, baseline - H + 24, 24, navy))
    if tagline:
        cy = baseline + 68
        body.append(tagline_block(W / 2, cy, navy))
        bottom = cy + 18
    return svg(W, bottom, "".join(body))


# ---------------- 2. 横向组合 ----------------
def build_horizontal(navy=NAVY, orange=ORANGE, with_r=False, mark_kw=None):
    pad, gap, vis_h = 24.0, 46.0, 176.0
    s = vis_h / BOX_H
    mw = BOX_W * s
    baseline = pad + vis_h
    m, mw, mh = place_mark(pad, pad, mw, navy, orange, **(mark_kw or {}))
    W = pad * 2 + mw + gap + WORD_W
    x0 = pad + mw + gap
    body = [m, wordmark(x0, baseline, navy)[0]]
    if with_r:
        body.append(reg_mark(x0 + WORD_W + 16, baseline - H + 24, 24, navy))
    return svg(W, baseline + pad, "".join(body))


# ---------------- 3. 竖向组合 ----------------
def build_stacked(navy=NAVY, orange=ORANGE, with_r=False, mark_kw=None):
    W, mw = WORD_W + 96, 392.0
    m, mw, mh = place_mark((W - mw) / 2, 0, mw, navy, orange, **(mark_kw or {}))
    baseline = mh + 46 + H
    x0 = (W - WORD_W) / 2
    body = [m, wordmark(x0, baseline, navy)[0]]
    if with_r:
        body.append(reg_mark(x0 + WORD_W + 18, baseline - H + 24, 24, navy))
    return svg(W, baseline + 4, "".join(body))


# ---------------- 4. 纯图标 ----------------
def build_mark(navy=NAVY, orange=ORANGE, mark_kw=None):
    return svg(BOX_W + 10, BOX_H + 10,
               place_mark(5, 5, BOX_W, navy, orange, **(mark_kw or {}))[0])


def build_favicon(mark_kw=None):
    """深蓝圆角方块底 + 反白帽标：小尺寸下对比度更高"""
    W = 128.0
    vis = 104.0
    s = vis / BOX_W
    mw, mh = BOX_W * s, BOX_H * s
    body = (f'<rect width="{W}" height="{W}" rx="28" fill="{NAVY}"/>'
            + place_mark((W - mw) / 2, (W - mh) / 2 - 4, vis, "#FFFFFF", ORANGE,
                         **(mark_kw or {}))[0])
    return svg(W, W, body)


def compact(svg_text):
    """把路径数据里的浮点压到 2 位，显著减小体积"""
    def r(m):
        v = float(m.group(0))
        t = f"{v:.2f}".rstrip("0").rstrip(".")
        return t if t not in ("", "-0") else "0"
    return re.sub(r"-?\d+\.\d{3,}", r, svg_text)


def write(name, content):
    p = os.path.join(OUT, name)
    with open(p, "w", encoding="utf-8") as f:
        f.write(compact(content))
    return p


FINAL_MARK = dict(rx=115, ry=82, seam_frac=0.72)

if __name__ == "__main__":
    files = {
        "shirun-hat-logo-primary.svg": build_primary(mark_kw=FINAL_MARK),
        "shirun-hat-logo-primary-with-r.svg": build_primary(with_r=True, mark_kw=FINAL_MARK),
        "shirun-hat-logo-horizontal.svg": build_horizontal(mark_kw=FINAL_MARK),
        "shirun-hat-logo-stacked.svg": build_stacked(mark_kw=FINAL_MARK),
        "shirun-hat-mark.svg": build_mark(mark_kw=FINAL_MARK),
        "favicon.svg": build_favicon(mark_kw=FINAL_MARK),
        "shirun-hat-logo-primary-mono.svg": build_primary(navy=NAVY, orange=NAVY, mark_kw=FINAL_MARK),
        "shirun-hat-logo-primary-reversed.svg": build_primary(navy="#FFFFFF", orange="#FFFFFF",
                                                              mark_kw=FINAL_MARK),
        "shirun-hat-logo-horizontal-reversed.svg": build_horizontal(navy="#FFFFFF", orange="#FFFFFF",
                                                                    mark_kw=FINAL_MARK),
    }
    for n, c in files.items():
        write(n, c)
        print("wrote", n, len(c), "bytes")
