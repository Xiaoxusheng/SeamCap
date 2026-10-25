from gen import *
body=[]
for s in mark_shapes():
    col = NAVY if s.get("stroke")=="NAVY" else None
    fill = ORANGE if s.get("fill")=="ORANGE" else "#000"
    if s.get("stroke"):
        body.append(f'<path d="{s["d"]}" fill="none" stroke="{col}" stroke-width="{s["sw"]}" stroke-linecap="round" stroke-linejoin="round"/>')
    else:
        body.append(f'<path d="{s["d"]}" fill="{fill}"/>')
svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 312 200" width="312" height="200"><rect width="312" height="200" fill="#fff"/>{"".join(body)}</svg>'
open("t_mark.svg","w",encoding="utf-8").write(svg)
print("done")
