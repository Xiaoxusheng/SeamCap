"""SHIRUN HAT 品牌 Logo 生成器（纯矢量，文字已转曲）"""
import math, os
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.misc.transform import Transform
import uharfbuzz as hb

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_SRC = r"C:\Users\雷龙\.workbuddy\binaries\node\workspace"

NAVY = "#06294F"
ORANGE = "#FA8100"


def prep_font(src, out, axes):
    if os.path.exists(out):
        return out
    f = TTFont(src)
    instantiateVariableFont(f, axes, inplace=True)
    f.save(out)
    return out


WORD_TTF = prep_font(os.path.join(FONT_SRC, "archivo.ttf"),
                     os.path.join(HERE, "Archivo-800.ttf"), {"wght": 800, "wdth": 100})
TAG_TTF = prep_font(os.path.join(FONT_SRC, "inter.ttf"),
                    os.path.join(HERE, "Inter-600.ttf"), {"wght": 600, "opsz": 14})

_cache = {}
def font_data(path):
    if path in _cache:
        return _cache[path]
    tt = TTFont(path)
    upem = tt["head"].unitsPerEm
    gs = tt.getGlyphSet()
    order = tt.getGlyphOrder()
    face = hb.Face(hb.Blob.from_file_path(path))
    _cache[path] = (upem, gs, order, hb.Font(face))
    return _cache[path]


def text_run(text, path, size, track_em=0.0, ox=0.0, oy=0.0):
    """返回 (d, advance_width, bbox)"""
    upem, gs, order, hbfont = font_data(path)
    scale = size / upem
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(hbfont, buf, {"kern": True, "liga": True})
    x = 0.0
    parts, bounds = [], [1e9, 1e9, -1e9, -1e9]
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        glyph = gs[order[info.codepoint]]
        t = Transform().translate(ox + (x + pos.x_offset) * scale,
                                  oy - pos.y_offset * scale).scale(scale, -scale)
        pen = SVGPathPen(gs)
        glyph.draw(TransformPen(pen, t))
        d = pen.getCommands()
        if d:
            parts.append(d)
        bp = BoundsPen(gs)
        glyph.draw(TransformPen(bp, t))
        if bp.bounds:
            bounds = [min(bounds[0], bp.bounds[0]), min(bounds[1], bp.bounds[1]),
                      max(bounds[2], bp.bounds[2]), max(bounds[3], bp.bounds[3])]
        x += pos.x_advance + track_em * upem
    width = x * scale - (track_em * size if text else 0)
    return " ".join(parts), width, tuple(bounds)


# ---------------- 贝塞尔工具 ----------------
def _bez(p, t):
    (x0, y0), (x1, y1), (x2, y2), (x3, y3) = p
    mt = 1 - t
    a, b, c, d = mt ** 3, 3 * mt ** 2 * t, 3 * mt * t ** 2, t ** 3
    return (a * x0 + b * x1 + c * x2 + d * x3, a * y0 + b * y1 + c * y2 + d * y3)


def _dbez(p, t):
    (x0, y0), (x1, y1), (x2, y2), (x3, y3) = p
    mt = 1 - t
    return (3 * mt ** 2 * (x1 - x0) + 6 * mt * t * (x2 - x1) + 3 * t ** 2 * (x3 - x2),
            3 * mt ** 2 * (y1 - y0) + 6 * mt * t * (y2 - y1) + 3 * t ** 2 * (y3 - y2))


def _rdp(pts, eps):
    if len(pts) < 3:
        return list(pts)
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dm, idx = -1, 0
    for i in range(1, len(pts) - 1):
        px, py = pts[i]
        dx, dy = x2 - x1, y2 - y1
        L = math.hypot(dx, dy) or 1
        d = abs(dy * (px - x1) - dx * (py - y1)) / L
        if d > dm:
            dm, idx = d, i
    if dm > eps:
        return _rdp(pts[:idx + 1], eps)[:-1] + _rdp(pts[idx:], eps)
    return [pts[0], pts[-1]]


def _smooth(pts, start_with_move=True):
    n = len(pts)
    out = [f"M {pts[0][0]:.2f} {pts[0][1]:.2f}"] if start_with_move else []
    for i in range(n - 1):
        p0 = pts[i - 1] if i > 0 else pts[i]
        p1, p2 = pts[i], pts[i + 1]
        p3 = pts[i + 2] if i + 2 < n else p2
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        out.append(f"C {c1[0]:.2f} {c1[1]:.2f} {c2[0]:.2f} {c2[1]:.2f} {p2[0]:.2f} {p2[1]:.2f}")
    return " ".join(out)


# ---------------- 帽子图形 ----------------
BRIM_P = ((8, 112), (96, 82), (210, 82), (332, 106))
BRIM_W = 36
BRIM_POW = 0.45
CROWN_X = 118          # 帽冠左端落在帽檐上的位置
APEX_X = 222           # 帽冠最高点


def _brim(ox=0.0, oy=0.0, n=260, wmax=BRIM_W, pw=BRIM_POW, p=None):
    p = p or BRIM_P
    up, dn = [], []
    for i in range(n + 1):
        t = i / n
        px, py = _bez(p, t)
        dx, dy = _dbez(p, t)
        L = math.hypot(dx, dy) or 1
        nx, ny = -dy / L, dx / L
        w = wmax * (t ** pw) / 2
        up.append((px - nx * w + ox, py - ny * w + oy))
        dn.append((px + nx * w + ox, py + ny * w + oy))
    return up, dn


def _ellipse_crown(cx, cy, rx, ry, brim_up, n=600):
    """从顶点向两侧下行，遇到帽檐上沿即停；返回 左底→顶→右底 的折线"""
    def top_at(x):
        return min(brim_up, key=lambda q: abs(q[0] - x))[1]

    left, right = [], []
    for i in range(n + 1):
        th = math.pi / 2 * (1 - i / n)      # 顶点 → 水平
        xl, yl = cx - rx * math.cos(th), cy - ry * math.sin(th)
        if yl >= top_at(xl):
            break
        left.append((xl, yl))
    for i in range(n + 1):
        th = math.pi / 2 * (1 - i / n)
        xr, yr = cx + rx * math.cos(th), cy - ry * math.sin(th)
        if yr >= top_at(xr):
            break
        right.append((xr, yr))
    return left[::-1] + right[1:]


def mark_shapes(wmax=None, pw=None, sw=7.0, rx=None, ry=None, cy=None, cx=None,
                seam_frac=None, p=None, close_end=True, sink=None, fit=False):
    wmax = BRIM_W if wmax is None else wmax
    pw = BRIM_POW if pw is None else pw
    p = p or BRIM_P
    up, dn = _brim(wmax=wmax, pw=pw, p=p)
    rx = 100 if rx is None else rx
    ry = 78 if ry is None else ry
    end_x = p[3][0]
    band_top_end = min(up, key=lambda q: abs(q[0] - end_x))[1]

    def crown_pts_for(rxv, cyv):
        return _ellipse_crown(end_x - rxv, cyv, rxv, ry, up)

    cyv = band_top_end + (sink if sink is not None else 0.0)
    if fit:
        best, bestd = rx, 1e9
        for k in range(60, 220):
            cand = k * 1.0
            pts_c = crown_pts_for(cand, cyv)
            if not pts_c:
                continue
            d = abs(pts_c[-1][0] - end_x)
            if d < bestd:
                bestd, best = d, cand
        rx = best
    cx = end_x - rx
    cy = cyv
    pts = _ellipse_crown(cx, cy, rx, ry, up)
    end_x = p[3][0]
    if close_end and pts:
        src = dn if close_end == "bottom" else up
        end_y = min(src, key=lambda q: abs(q[0] - end_x))[1]
        pts = pts + [(end_x, end_y)]
    crown = _rdp(pts, 0.25)
    outline = _smooth(crown)
    b_dn = _rdp(dn, 0.3)
    lens = (_smooth(_rdp(up, 0.3)) + f" L {dn[-1][0]:.1f} {dn[-1][1]:.1f} "
            + _smooth(b_dn[::-1])[2:] + " Z")
    shapes = [dict(d=outline, stroke=NAVY, sw=sw)]
    if seam_frac:
        sx = (cx - rx) + 2 * rx * seam_frac
        k = max(0.0, 1 - ((sx - cx) / rx) ** 2)
        ty = cy - ry * math.sqrt(k)
        by = min(up, key=lambda q: abs(q[0] - sx))[1]
        if by > ty + 2:
            shapes.append(dict(
                d=f"M {sx:.1f} {ty + 3:.1f} C {sx + 9:.1f} {(ty + by) / 2:.1f} "
                  f"{sx + 10:.1f} {(ty + by) / 2 + 6:.1f} {sx + 3:.1f} {by - 1:.1f}",
                stroke=NAVY, sw=sw * 0.55))
    # 帽檐：先描粗边，再用橙色填充盖掉内半圈 —— 轮廓净宽仍为 sw，尖端保持橙色的锐角
    shapes.append(dict(d=lens, stroke=NAVY, sw=sw * 2))
    shapes.append(dict(d=lens, fill=ORANGE))
    return shapes


MARK_W, MARK_H = 336, 140


def mark_svg(fill_navy=NAVY, fill_orange=ORANGE, scale=1.0, dx=0.0, dy=0.0, **kw):
    els = []
    for s in mark_shapes(**kw):
        if s.get("fill") == ORANGE:
            els.append(f'<path d="{s["d"]}" fill="{fill_orange}"/>')
        else:
            els.append(f'<path d="{s["d"]}" fill="none" stroke="{fill_navy}" '
                       f'stroke-width="{s["sw"]:.2f}" stroke-linecap="round" stroke-linejoin="round"/>')
    g = "".join(els)
    if scale != 1.0 or dx or dy:
        g = f'<g transform="translate({dx:.2f} {dy:.2f}) scale({scale:.5f})">{g}</g>'
    return g
