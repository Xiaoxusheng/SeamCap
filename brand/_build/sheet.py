"""生成品牌规范页 brand-sheet.html（内联 SVG，单文件可分发）"""
import os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
LOGO = os.path.join(ROOT, "logo")


def inline(name, cls="", alt=""):
    s = open(os.path.join(LOGO, name), encoding="utf-8").read()
    s = re.sub(r'\s(width|height)="[\d.]+"', "", s, count=2)
    stripped = re.sub(r'^<svg ', "<svg ", s)
    stripped = stripped.replace("<svg ", f'<svg class="{cls}" role="img" aria-label="{alt}" ', 1)
    return stripped


HTML = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SHIRUN HAT · 品牌与标识规范</title>
<style>
  :root{
    --navy:#06294F; --orange:#FA8100;
    --ink:#0E1B2A; --muted:#5A6B7D; --line:#E3E8EE; --line-soft:#EFF3F7;
    --max:1080px;
  }
  *{box-sizing:border-box}
  html{-webkit-font-smoothing:antialiased}
  body{
    margin:0; background:#fff; color:var(--ink);
    font-family:"Segoe UI","Helvetica Neue",Arial,"Microsoft YaHei",sans-serif;
    font-size:15px; line-height:1.75;
  }
  .wrap{max-width:var(--max); margin:0 auto; padding:0 40px}
  header{border-bottom:1px solid var(--line); padding:56px 0 40px}
  .eyebrow{
    font-size:11px; letter-spacing:.22em; text-transform:uppercase;
    color:var(--orange); font-weight:700; margin:0 0 18px;
  }
  h1{margin:0; font-size:34px; line-height:1.25; letter-spacing:-.01em; font-weight:800; color:var(--navy)}
  .lede{margin:14px 0 0; color:var(--muted); font-size:15px; max-width:56ch}
  section{padding:56px 0; border-bottom:1px solid var(--line-soft)}
  section:last-of-type{border-bottom:0}
  h2{
    font-size:12px; letter-spacing:.2em; text-transform:uppercase;
    color:var(--navy); font-weight:800; margin:0 0 8px;
  }
  .sub{margin:0 0 28px; color:var(--muted); font-size:14px}
  .panel{background:#fff; border:1px solid var(--line); border-radius:2px; padding:48px 40px}
  .panel + .panel{margin-top:16px}
  .dark{background:var(--navy); border-color:var(--navy)}
  .dark .label{color:rgba(255,255,255,.6)}
  .label{
    font-size:11px; letter-spacing:.16em; text-transform:uppercase;
    color:var(--muted); font-weight:700; margin:0 0 26px;
  }
  .logo-primary{display:block; width:100%; max-width:640px; margin:0 auto}
  .logo-horizontal{display:block; width:100%; max-width:760px; margin:0 auto}
  .logo-stacked{display:block; width:100%; max-width:420px; margin:0 auto}
  .logo-mark{display:block; width:100%; max-width:260px; margin:0 auto}

  .grid-2{display:grid; grid-template-columns:1fr 1fr; gap:16px}
  .swatches{display:grid; grid-template-columns:repeat(3,1fr); gap:24px}
  .sw{border:1px solid var(--line)}
  .sw .chip{height:112px}
  .sw .meta{padding:14px 16px 16px}
  .sw .name{font-weight:700; font-size:14px; color:var(--ink); margin:0 0 4px}
  .sw .hex{font-family:ui-monospace,SFMono-Regular,Consolas,monospace; font-size:13px; color:var(--muted); margin:0}
  .sw .role{font-size:12px; color:var(--muted); margin:6px 0 0}

  .rules{display:grid; grid-template-columns:1fr 1fr; gap:32px 40px; margin:0; padding:0; list-style:none}
  .rules li{padding-left:0}
  .rules b{display:block; color:var(--navy); font-size:13px; letter-spacing:.02em; margin-bottom:4px}
  .rules span{color:var(--muted); font-size:13.5px}

  table{width:100%; border-collapse:collapse; font-size:13.5px}
  th,td{text-align:left; padding:12px 0; border-bottom:1px solid var(--line-soft); vertical-align:top}
  th{font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); font-weight:700}
  td.mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace; font-size:12.5px; color:var(--ink)}
  td.dim{color:var(--muted)}
  footer{padding:40px 0 64px; color:var(--muted); font-size:13px}
  @media (max-width:760px){
    .wrap{padding:0 24px}
    .grid-2,.swatches,.rules{grid-template-columns:1fr}
  }
</style>
</head>
<body>
<header>
  <div class="wrap">
    <p class="eyebrow">Brand Identity · 2026</p>
    <h1>SHIRUN HAT<br>品牌与标识规范</h1>
    <p class="lede">面向海外进口商、批发商与品牌客户的无痕帽制造与出口品牌。本页为标识使用的唯一依据：所有对外物料——网站、产品目录、形式发票、社交媒体——均以本页版本为准。</p>
  </div>
</header>

<section>
  <div class="wrap">
    <h2>01 · 主标识</h2>
    <p class="sub">深海军蓝承载专业与可信，橙色只出现在帽檐——一个色块，一个记忆点。</p>
    <div class="panel">
      <p class="label">Primary lockup</p>
      __PRIMARY__
    </div>
    <div class="panel dark" style="margin-top:16px">
      <p class="label">Reversed · 用于深底</p>
      __REVERSED__
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <h2>02 · 组合形式</h2>
    <p class="sub">按可用空间选择，不自行重排比例或改变元素间距。</p>
    <div class="grid-2">
      <div class="panel">
        <p class="label">Horizontal · 页眉 / 邮件签名</p>
        __HORIZONTAL__
      </div>
      <div class="panel">
        <p class="label">Stacked · 目录封面 / 社媒</p>
        __STACKED__
      </div>
    </div>
    <div class="grid-2" style="margin-top:16px">
      <div class="panel">
        <p class="label">Mark only · 头像 / 吊牌</p>
        __MARK__
      </div>
      <div class="panel">
        <p class="label">Mono · 单色印刷 / 绣标</p>
        __MONO__
      </div>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <h2>03 · 色彩</h2>
    <p class="sub">两个主色，一个中性色。橙色占比不超过整体的 10%。</p>
    <div class="swatches">
      <div class="sw">
        <div class="chip" style="background:#06294F"></div>
        <div class="meta">
          <p class="name">Shirun Navy</p>
          <p class="hex">#06294F</p>
          <p class="role">R6 G41 B79 · 主色，占 85%</p>
        </div>
      </div>
      <div class="sw">
        <div class="chip" style="background:#FA8100"></div>
        <div class="meta">
          <p class="name">Cap Orange</p>
          <p class="hex">#FA8100</p>
          <p class="role">R250 G129 B0 · 强调，占 ≤10%</p>
        </div>
      </div>
      <div class="sw">
        <div class="chip" style="background:#0E1B2A"></div>
        <div class="meta">
          <p class="name">Ink</p>
          <p class="hex">#0E1B2A</p>
          <p class="role">正文文字</p>
        </div>
      </div>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <h2>04 · 使用规则</h2>
    <p class="sub">四条硬性约束，其余交给常识。</p>
    <ul class="rules">
      <li><b>最小尺寸</b><span>横版标识不小于 120px 宽（印刷 28mm）；纯图形不小于 24px 高。低于此尺寸请只用图形。</span></li>
      <li><b>清空区</b><span>四周留白至少等于字标大写字母高度的一半，任何文字、图片、边框不得进入。</span></li>
      <li><b>不可改动</b><span>不得拉伸、倾斜、加描边或投影，不得更换配色，不得把橙色用于帽冠或字母。</span></li>
      <li><b>底色</b><span>浅底用彩色版，深底用反白版。禁止放在照片、渐变或花纹上；必须放时先铺一层 90% 深蓝蒙版。</span></li>
    </ul>
  </div>
</section>

<section>
  <div class="wrap">
    <h2>05 · 文件清单</h2>
    <p class="sub">矢量文件可直接用于印刷与大幅面；PNG 为透明背景、无水印。</p>
    <table>
      <thead><tr><th>文件</th><th>用途</th><th>尺寸</th></tr></thead>
      <tbody>
        <tr><td class="mono">logo/shirun-hat-logo-primary.svg</td><td class="dim">主标识，目录封面、形式发票抬头</td><td class="dim">矢量</td></tr>
        <tr><td class="mono">logo/shirun-hat-logo-horizontal.svg</td><td class="dim">网站页眉、邮件签名</td><td class="dim">矢量</td></tr>
        <tr><td class="mono">logo/shirun-hat-logo-stacked.svg</td><td class="dim">社媒封面、展会展板</td><td class="dim">矢量</td></tr>
        <tr><td class="mono">logo/shirun-hat-mark.svg</td><td class="dim">头像、吊牌、绣标</td><td class="dim">矢量</td></tr>
        <tr><td class="mono">logo/*-mono.svg · *-reversed.svg</td><td class="dim">单色印刷 / 深底</td><td class="dim">矢量</td></tr>
        <tr><td class="mono">png/shirun-hat-logo-primary@3000.png</td><td class="dim">高清透明 PNG，印刷备用</td><td class="dim">3000px</td></tr>
        <tr><td class="mono">png/shirun-hat-mark@1024.png</td><td class="dim">社交头像 / 平台上传</td><td class="dim">1024px</td></tr>
      </tbody>
    </table>
  </div>
</section>

<footer>
  <div class="wrap">
    SHIRUN HAT · Seamless Hat Manufacturer &amp; Exporter &nbsp;|&nbsp; shirunhat.com
  </div>
</footer>
</body>
</html>
"""

html = (HTML
        .replace("__PRIMARY__", inline("shirun-hat-logo-primary.svg", "logo-primary", "SHIRUN HAT logo"))
        .replace("__REVERSED__", inline("shirun-hat-logo-primary-reversed.svg", "logo-primary", "SHIRUN HAT logo reversed"))
        .replace("__HORIZONTAL__", inline("shirun-hat-logo-horizontal.svg", "logo-horizontal", "SHIRUN HAT horizontal logo"))
        .replace("__STACKED__", inline("shirun-hat-logo-stacked.svg", "logo-stacked", "SHIRUN HAT stacked logo"))
        .replace("__MARK__", inline("shirun-hat-mark.svg", "logo-mark", "SHIRUN HAT mark"))
        .replace("__MONO__", inline("shirun-hat-logo-primary-mono.svg", "logo-stacked", "SHIRUN HAT mono logo")))

out = os.path.join(ROOT, "brand-sheet.html")
open(out, "w", encoding="utf-8").write(html)
print("wrote", out, len(html))
