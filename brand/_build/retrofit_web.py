"""把公开站 8 个页面的文字品牌块换成 Logo（深浅两套，随主题切换）"""
import os, re, glob

WEB = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "web"))
PAGES = sorted(glob.glob(os.path.join(WEB, "*.html")))
PAGES = [p for p in PAGES if os.path.basename(p) not in ("404.html", "atelier.html")]

W_ATTR = 'width="1407" height="224"'


def header_block(href, label):
    return (
        f'<a class="brand" href="{href}" aria-label="{label}">\n'
        f'      <img class="brand__logo brand__logo--dark" src="static/img/brand/logo-on-dark.svg" '
        f'alt="SHIRUN HAT" {W_ATTR}/>\n'
        f'      <img class="brand__logo brand__logo--light" src="static/img/brand/logo-on-light.svg" '
        f'alt="" aria-hidden="true" {W_ATTR}/>\n'
        f'    </a>'
    )


FOOTER = (
    '<p class="brand footer__brand">\n'
    '        <img class="brand__logo brand__logo--dark" src="static/img/brand/logo-on-dark.svg" '
    'alt="SHIRUN HAT" ' + W_ATTR + '/>\n'
    '        <img class="brand__logo brand__logo--light" src="static/img/brand/logo-on-light.svg" '
    'alt="" aria-hidden="true" ' + W_ATTR + '/>\n'
    '      </p>'
)

hdr = re.compile(r'<a class="brand"[^>]*>\s*<span class="brand__name">SHIRUN</span>.*?</a>', re.S)
ftr = re.compile(r'<p class="brand footer__brand">.*?</p>', re.S)

report = []
for p in PAGES:
    s = open(p, encoding="utf-8").read()
    orig = s

    def hrepl(m):
        href = re.search(r'href="([^"]+)"', m.group(0)).group(1)
        label = re.search(r'aria-label="([^"]+)"', m.group(0)).group(1)
        label = label.replace("SHIRUN Headwear", "SHIRUN HAT")
        return header_block(href, label)

    s, n_h = hdr.subn(hrepl, s)
    s, n_f = ftr.subn(FOOTER, s)
    if s != orig:
        open(p, "w", encoding="utf-8").write(s)
    report.append((os.path.basename(p), n_h, n_f))

for r in report:
    print("%-24s header=%d footer=%d" % r)
