from gen import *
svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {MARK_W} {MARK_H}"><rect width="{MARK_W}" height="{MARK_H}" fill="#fff"/>{mark_svg()}</svg>'
open("t_mark.svg","w",encoding="utf-8").write(svg)
