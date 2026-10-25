from gen import *
import build
V = [dict(rx=104, ry=82), dict(rx=115, ry=82), dict(rx=115, ry=82, seam_frac=0.72), dict(rx=124, ry=88, seam_frac=0.68)]
for i,kw in enumerate(V):
    svg = build.build_primary(mark_kw=kw)
    open(f"v{i}.svg","w",encoding="utf-8").write(svg)
print("ok")
