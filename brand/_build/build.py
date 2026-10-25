"""生成 SHIRUN HAT 全部 Logo 文件"""
import os
from gen import (NAVY, ORANGE, WORD_TTF, TAG_TTF, text_run, mark_svg,
                 MARK_W, MARK_H)

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "logo"))
os.makedirs(OUT, exist_ok=True)

TAGLINE = "SEAMLESS HAT MANUFACTURER & EXPORTER"
H = 100.0                      # 字标大写字母高度
CAP = 0.687                    # Archivo 800 cap height / em
SIZE = H / CAP
TRACK = -0.018                 # 字标字距（em）
GAP = 0.36 * H                 # SHIRUN 与 HAT 的间隔


def run(text, x, baseline, size=SIZE, font=WORD_TTF, track=TRACK, color=NAVY):
    d, w, bb = text_run(text, font, size, track, x, baseline)
    return f'<path d="{d}" fill="{color}"/>', w, bb


def measure(text, size, font, track):
    _, w, bb = text_run(text, font, size, track)
    return w, bb


def svg(w, h, body, bg=False):
    rect = f'<rect width="{w:.2f}" height="{h:.2f}" fill="#fff"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.2f} {h:.2f}" '
            f'width="{w:.2f}" height="{h:.2f}">' + rect + body + "</svg>")


def wordmark(cx, baseline, gap=GAP, color=NAVY, track=TRACK):
    """以 cx 为中心排 SHIRUN HAT"""
    w1, _ = measure("SHIRUN", SIZE, WORD_TTF, track)
    w2, _ = measure("HAT", SIZE, WORD_TTF, track)
    total = w1 + gap + w2
    x0 = cx - total / 2
    a, _, _ = run("SHIRUN", x0, baseline, color=color)
    b, _, _ = run("HAT", x0 + w1 + gap, baseline, color=color)
    return a + b, total, x0


def tagline_block(cx, cap_center_y, color=NAVY, rule=True):
    size = 21.0
    track = 0.15
    w, bb = measure(TAGLINE, size, TAG_TTF, track)
    # 大写字母视觉中心：用 bbox 校正
    baseline = cap_center_y + (bb[3] - bb[1]) / 2
    x0 = cx - w / 2
    d, _, _ = text_run(TAGLINE, TAG_TTF, size, track, x0, baseline)
    els = [f'<path d="{d}" fill="{color}"/>']
    total = w
    if rule:
        rl, gapx, sw = 92.0, 26.0, 2.2
        y = cap_center_y
        els.insert(0, f'<path d="M {x0 - gapx - rl:.1f} {y:.1f} H {x0 - gapx:.1f}" stroke="{color}" '
                      f'stroke-width="{sw}" stroke-linecap="round"/>')
        els.append(f'<path d="M {x0 + w + gapx:.1f} {y:.1f} H {x0 + w + gapx + rl:.1f}" stroke="{color}" '
                   f'stroke-width="{sw}" stroke-linecap="round"/>')
        total = w + 2 * (gapx + rl)
    return "".join(els), total


def reg_mark(x, y, size=26, color=NAVY):
    """® 上标"""
    d, _, _ = text_run("®", TAG_TTF, size, 0, x, y)
    return f'<path d="{d}" fill="{color}"/>'


# ---------------- 1. 主锁定组合：帽标 + 字标 + 标语 ----------------
def build_primary(navy=NAVY, orange=ORANGE, with_r=False, tagline=True, mark_kw=None):
    W = 1000.0
    mark_w = 592.0
    ms = mark_w / MARK_W
    mark_h = MARK_H * ms
    mx = (W - mark_w) / 2
    my = 0.0

    word_cap_top = mark_h + 34
    baseline = word_cap_top + H
    wm, wm_w, wm_x0 = wordmark(W / 2, baseline, color=navy)

    body = [mark_svg(fill_navy=navy, fill_orange=orange, scale=ms, dx=mx, dy=my, **(mark_kw or {})), wm]
    bottom = baseline
    if with_r:
        body.append(reg_mark(wm_x0 + wm_w + 20, baseline - H + 26, 26, navy))
    if tagline:
        cy = baseline + 66
        tb, tw = tagline_block(W / 2, cy, color=navy)
        body.append(tb)
        bottom = cy + 16
    return svg(W, bottom, "".join(body))


# ---------------- 2. 横向组合：帽标在左 ----------------
def build_horizontal(navy=NAVY, orange=ORANGE, with_r=False):
    mark_h = 186.0
    ms = mark_h / MARK_H
    mark_w = MARK_W * ms
    pad_x, pad_y, gap = 6.0, 30.0, 58.0
    w1, _ = measure("SHIRUN", SIZE, WORD_TTF, TRACK)
    w2, _ = measure("HAT", SIZE, WORD_TTF, TRACK)
    W = pad_x + mark_w + gap + w1 + GAP + w2 + pad_x
    mark_y = pad_y
    cap_center = mark_y + mark_h / 2
    baseline = cap_center + H / 2
    body = [mark_svg(fill_navy=navy, fill_orange=orange, scale=ms, dx=pad_x, dy=mark_y)]
    x0 = pad_x + mark_w + gap
    a, _, _ = run("SHIRUN", x0, baseline, color=navy)
    b, _, _ = run("HAT", x0 + w1 + GAP, baseline, color=navy)
    body += [a, b]
    if with_r:
        body.append(reg_mark(x0 + w1 + GAP + w2 + 16, baseline - H + 24, 24, navy))
    return svg(W, pad_y * 2 + mark_h, "".join(body))


# ---------------- 3. 竖向组合：帽标居中于字标之上 ----------------
def build_stacked(navy=NAVY, orange=ORANGE, with_r=False):
    W = 780.0
    mark_w = 330.0
    ms = mark_w / MARK_W
    mark_h = MARK_H * ms
    mark_y = 0
    baseline = mark_h + 40 + H
    wm, wm_w, wm_x0 = wordmark(W / 2, baseline, color=navy)
    body = [mark_svg(fill_navy=navy, fill_orange=orange, scale=ms, dx=(W - mark_w) / 2, dy=mark_y), wm]
    if with_r:
        body.append(reg_mark(wm_x0 + wm_w + 18, baseline - H + 24, 24, navy))
    return svg(W, baseline + 4, "".join(body))


# ---------------- 4. 纯图标 ----------------
def build_mark(navy=NAVY, orange=ORANGE, pad=8):
    w = MARK_W + pad * 2
    h = MARK_H + pad * 2
    return svg(w, h, mark_svg(fill_navy=navy, fill_orange=orange, dx=pad, dy=pad))


def write(name, content):
    p = os.path.join(OUT, name)
    with open(p, "w", encoding="utf-8") as f:
        f.write(content)
    return p


if __name__ == "__main__":
    files = {
        "shirun-hat-logo-primary.svg": build_primary(),
        "shirun-hat-logo-primary-with-r.svg": build_primary(with_r=True),
        "shirun-hat-logo-horizontal.svg": build_horizontal(),
        "shirun-hat-logo-stacked.svg": build_stacked(),
        "shirun-hat-mark.svg": build_mark(),
        "shirun-hat-logo-primary-mono.svg": build_primary(navy="#06294F", orange="#06294F"),
        "shirun-hat-logo-primary-reversed.svg": build_primary(navy="#FFFFFF", orange="#FFFFFF"),
        "shirun-hat-logo-horizontal-reversed.svg": build_horizontal(navy="#FFFFFF", orange="#FFFFFF"),
    }
    for n, c in files.items():
        write(n, c)
        print("wrote", n, len(c), "bytes")
