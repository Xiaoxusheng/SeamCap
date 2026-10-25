# Atelier Concept Home Overrides

> **PROJECT:** SHIRUN LUXE
> **Page Type:** Landing / Concept homepage（`web/atelier.html`，替代首页的候选方案）
> **Generated:** 2026-10-25

> ⚠️ 本文件只记录**偏离** MASTER 的部分；其余沿用 `design-system/shirun-luxe/MASTER.md`。

---

## 页面定位

面向买家的「静默奢华」落地页：以单品（Objects）→ 工艺叙事（Making）→ 品牌准则（Standard）→ 私享会（Circle）四段推进，替代现有首页的「产品目录 + 工厂实拍」结构。

## 布局

- 内容宽度 `--max: 1280px`，桌面留白 64px（移动端 32px）
- 区块纵向节奏：桌面 118px / 移动 68px；Circle 区 132px
- Hero：双栏 `1.02fr / .98fr`，导航为悬浮玻璃胶囊（不是整条通栏）

## 颜色（在 MASTER 基础上的暗调落地值）

| 角色 | 值 | 用途 |
|---|---|---|
| 底 | `#070605` | 页面背景（比 MASTER 的 `#1C1917` 更深） |
| 正文 | `rgba(245,241,234,.92)` | 标题与主文本 |
| 次文 | `rgba(245,241,234,.64)` | 说明文字 |
| 弱文 | `rgba(245,241,234,.52)` | 小号 meta（≥4.5:1，勿再降低） |
| 金 | `#C9A24B` / `#E8CE9E` | 强调、按钮、细线 |

## Liquid Glass 规范（本项目落地版）

```css
background: linear-gradient(155deg, rgba(255,255,255,.13), rgba(255,255,255,.045) 44%, rgba(255,255,255,.075));
backdrop-filter: blur(24px) saturate(158%);
border: 1px solid rgba(255,255,255,.16);
box-shadow: 0 34px 70px -38px rgba(0,0,0,.95),
            inset 0 1px 0 rgba(255,255,255,.30),
            inset 0 -1px 0 rgba(255,255,255,.05);
```

约束（来自 style: liquid-glass 的可访问性要求）：

- 玻璃**只用于导航与控件层**（导航胶囊、规格浮卡、产品标签条、准则卡、会员卡）；正文内容永远在实底上。
- 玻璃压在**浅色图片**上时必须换深色玻璃（`rgba(20,17,14,.9)` 起），否则文字不可读 —— 见 `.at-spec` / `.at-card__rail`。
- 指针跟随高光用 CSS 变量 `--mx/--my` + `radial-gradient`，不用 canvas；`prefers-reduced-motion` 与触屏下关闭。
- 光晕用 radial-gradient 实现，**不要用 `filter: blur()`**（离屏边缘会被裁出硬边，见 2026-10-25 排障）。
- 移动端隐藏 `.at-spec` 浮卡（避免 backdrop-filter 合成瑕疵）。

## 组件

| 组件 | 说明 |
|---|---|
| 导航胶囊 | 高 64 → 滚动 56，`is-scrolled` 时底色转深 |
| 主按钮 | 金色渐变 + 顶部内高光，hover 上移 2px（不变尺寸，不抖动） |
| 玻璃按钮 | 半透明 + 1px 边，hover 提高透明度 |
| 产品卡 | 浅色「纸面」+ 产品图 `mix-blend-mode: multiply`，底部浮深色玻璃信息条 |
| 章节 | 图文交替（`--flip`），竖版 4/4.6 图 + 大号序号水印 |
| 准则卡 | 4 列玻璃卡 + 线性 SVG 图标（无 emoji） |
| 会员卡 | 1.6:1，金色细线 + 指针微倾斜（±8deg / ±6deg）+ 扫光 |

## 动效

- 揭示：`IntersectionObserver` 加类（无 JS 时内容直接可见），800ms `cubic-bezier(.16,1,.3,1)`，同组级联 ≤280ms
- 跑马灯 38s 线性；`prefers-reduced-motion` 下全部关闭
- 页面滚动用原生 smooth（reduce 时 auto）

## 验证结论（2026-10-25）

- 1440 / 390 两档：0 JS 错误、0 破图、无横向溢出
- 键盘 Tab 顺序正确，focus 2px 金色描边可见
- 移动端抽屉：ESC 关闭、body 锁滚动
- reduced-motion：不添加 reveal 类，内容立即可见
