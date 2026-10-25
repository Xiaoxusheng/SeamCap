from gen import *
V = [
  dict(wmax=26, pw=0.32, sw=6.4, rx=100, ry=78, cx=216),
  dict(wmax=26, pw=0.36, sw=6.4, rx=100, ry=78, cx=216, close_end="bottom"),
  dict(wmax=26, pw=0.28, sw=6.4, rx=100, ry=78, cx=216, close_end="bottom"),
  dict(wmax=24, pw=0.34, sw=6.2, rx=104, ry=72, cx=214, close_end="bottom"),
]
pad=10
cells=[f'<g transform="translate({pad} {pad+i*(MARK_H+26)})">{mark_svg(**kw)}</g>' for i,kw in enumerate(V)]
H = pad*2 + len(V)*(MARK_H+26)
svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {MARK_W+pad*2} {H}"><rect width="100%" height="100%" fill="#fff"/>' + "".join(cells) + '</svg>'
open("t_var.svg","w",encoding="utf-8").write(svg)
