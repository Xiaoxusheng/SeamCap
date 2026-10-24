# SeamCap Admin · Design System Master

> **适用范围：** `web/admin-src/` 管理后台（Blackrail 黑白细边框企业后台）。
> **不适用：** 公开站 `design-system/shirun-luxe/`（独立视觉体系，请勿互相套用）。
>
> **方向决策（2026-10-24 修订）：** 本工作区最终采用「纯黑侧栏 + 白色顶栏 + 浅灰中性工作区」的 Blackrail 方案。早先的 Mintlight 薄荷绿方案与钴蓝导航方案均已废弃；颜色只以语义色形式出现在数据表达上。后续页面必须遵循本文件。

**Project:** SeamCap
**Scope:** Admin console
**Updated:** 2026-10-24
**Status:** Implemented（仪表盘精细化改造后 `npm run build` 通过）

---

## 1. 设计理念

Blackrail Enterprise Console 是一个面向外贸帽饰工厂的轻量内容管理工作台：

- **Monochrome Base** — 黑色导航、白色内容卡、浅灰画布、1px 低对比度细边界；黑白中性色打底。
- **Semantic Accent** — 蓝 / 绿 / 琥珀 / 珊瑚红只用于状态、比例条、短标签等重点区域，不做大面积涂色。
- **Content First** — 产品图、工艺封面与真实业务数据是主角，装饰退后。
- **Operational Clarity** — 侧栏负责模块切换，顶栏负责搜索/通知/账户，工作区按页面任务构图。
- **Quiet Motion** — 120–220ms 的微交互，页面入场垂直位移 ≤4px，不用大面积动画掩盖信息层级。
- **Real Business Only** — 所有指标、图表、列表与素材都来自真实接口，禁止假数据、假趋势、假进度。

---

## 2. 色彩 Token

所有颜色通过 `src/styles/admin.css` 的 CSS 变量或 AntD Theme Token 使用，禁止页面硬编码品牌色。

### 2.1 画布与表面

| Token | 值 | 用途 |
|---|---|---|
| `--sc-bg` | `#F4F5F6` | 工作区主画布 |
| `--sc-bg-subtle` | `#F8F9FA` | 次级底色（`--sc-bg-soft` 别名） |
| `--sc-surface` | `#FFFFFF` | 面板、表格、表单表面 |
| `--sc-surface-soft` | `#F7F8F9` | 弱区域底 |
| `--sc-surface-hover` | `#F0F2F4` | 行/卡片 Hover |
| `--sc-surface-selected` | `#E8EAED` | 选中态底色 |
| `--sc-surface-muted` | `#EEF0F2` | 工具条、弱区域 |
| `--sc-border` | `#E4E9E6` | 1px 主边界 |
| `--sc-border-strong` | `#D2DCD8` | 控件/Hover 边界、次级按钮边框 |
| `--sc-border-soft` | `#EDF2EF` | 表格行、内部细线 |
| `--sc-track` | `#E9EBED` | 进度条轨道 |

### 2.2 文字

| Token | 值 | 用途 |
|---|---|---|
| `--sc-text` | `#101614` | 标题、正文、指标数值 |
| `--sc-text-secondary` | `#586661` | 次级正文、标签 |
| `--sc-text-muted` | `#86958F` | 说明、时间、辅助信息 |
| `--sc-text-disabled` | `#B3BEB9` | 禁用、占位 |

兼容旧页面的别名：`--sc-ink`、`--sc-ink-secondary`、`--sc-ink-muted`、`--sc-ink-disabled`。

### 2.3 品牌黑白

| Token | 值 | 用途 |
|---|---|---|
| `--sc-primary` | `#111418` | 主操作、当前导航、关键强调 |
| `--sc-primary-hover` | `#000000` | 主按钮 Hover |
| `--sc-primary-active` | `#000000` | 主按钮 Active |
| `--sc-primary-soft` | `#EEF0F3` | 图标底板、选中浅底 |
| `--sc-primary-border` | `#C9CDD3` | 浅边框 |
| `--sc-on-primary` | `#FFFFFF` | 主按钮文字 |

### 2.4 数据语义色

| 语义 | Token | 值 |
|---|---|---|
| 信息 / 工艺 / 跟进 | `--sc-blue` / `--sc-blue-soft` / `--sc-blue-ink` | `#4E8BEE` / `#EAF1FE` / `#3768BD` |
| 成功 / 已发布 | `--sc-green` / `--sc-green-soft` / `--sc-green-ink` | `#27A86A` / `#E8F6EE` / `#1D7C4C` |
| 草稿 / 待完善 | `--sc-amber` / `--sc-amber-soft` / `--sc-amber-ink` | `#E6A13B` / `#FFF4DF` / `#976311` |
| 新询价 / 提醒 | `--sc-coral` / `--sc-coral-soft` / `--sc-coral-ink` | `#F16F73` / `#FFEEEF` / `#B34A4D` |
| 辅助数据 | `--sc-violet` / `--sc-violet-soft` | `#8A7AE6` / `#F1EEFF` |
| 归档 / 停用 | `--sc-gray` / `--sc-gray-soft` / `--sc-gray-ink` | `#84918F` / `#F1F4F3` / `#5F6D68` |
| 危险 / 失败 | `--sc-danger` / `--sc-danger-soft` | `#D4615F` / `#FFF0F0` |

比例：70–80% 中性色，15–20% 文字与边界，5–10% 语义色。语义色只承担明确职责（状态、比例条、短标签、图标底板），不允许每张卡片涂一种颜色，也不允许进度条退化为黑色。

### 2.5 导航专用（纯黑侧栏）

| Token | 值 |
|---|---|
| `--sc-sidebar-bg` / `--sc-nav-bg` | `#000000` |
| `--sc-nav-border` | `#171A19` |
| `--sc-sidebar-text` / `--sc-nav-text` | `#9AA5A1` |
| `--sc-sidebar-icon` | `#808B87` |
| `--sc-sidebar-selected` / `--sc-nav-active-bg` | `#E8EAED` |
| `--sc-sidebar-selected-text` | `#101614` |
| `--sc-sidebar-group` | `#5F6A65` |

深色主题下侧栏保持纯黑，工作区转深灰（`--sc-bg #0B0E0D`、`--sc-surface #141817`、`--sc-border #262D2A`），语义色整体提亮。

---

## 3. 字体与排版

```css
font-family: Inter, -apple-system, BlinkMacSystemFont, "PingFang SC",
  "Microsoft YaHei", sans-serif;
font-family-code: ui-monospace, "SFMono-Regular", "JetBrains Mono", Menlo,
  Consolas, monospace;
```

| 层级 | 规格 | 用途 |
|---|---|---|
| 页面标题 | 22–24px / 600（仪表盘 23px） | PageHeader h1；仅仪表盘可见 |
| 面板标题 | 14px / 600 | 表格面板、区块标题 |
| 指标数值 | 30–34px / 600，tabular-nums | 仪表盘指标（当前 32px） |
| 正文 | 13–14px / 400，line-height 1.55 | 通用 |
| 表头 | 12px / 500–600 | 数据表 |
| 辅助说明 | 11–12px / 400 | 描述、时间、SKU |

- 数字使用 `font-variant-numeric: tabular-nums`（`.sc-tabular`）。
- SKU、Slug、文件名、IP、动作名使用等宽字体（`.sc-mono` / `.sc-code`）。
- 不靠全部加粗制造层级；正文 400，标题 600。

---

## 4. 布局与导航

### 4.1 桌面框架

```text
┌──────────────┬──────────────────────────────────────────────┐
│  SeamCap     │ 折叠 · 面包屑   搜索(Ctrl+K) 主题 通知 管理员 │ 56px 顶栏
│  Admin       ├──────────────────────────────────────────────┤
│  (纯黑)      │  页面标题区（仅仪表盘）/ 快捷导航（其他页面）│
│  工作台      │                                              │
│  产品中心    │  当前页面专属的指标、目录、表格、编辑器      │
│  ...         │                                              │
└──────────────┴──────────────────────────────────────────────┘
  236px 纯黑侧栏
```

- 侧栏：236px 纯黑，粘性全高；收起后 72px，图标 + Tooltip；分组可折叠，状态持久化。
- 顶栏：56px 白色玻璃（blur），含真实全局搜索、主题切换（浅/深/跟随系统）、新询价通知、管理员菜单。
- 工作区：最大 1520px，左右留白 20px（移动端 16px）。
- **QuickNav（页面快捷导航条）：** 仅在非仪表盘页面显示；仪表盘 `/admin`、`/admin/` 由 `AdminLayout.tsx` 判定路径后不渲染，避免与侧栏、面包屑三重重复。

### 4.2 PageHeader 规则

- 全局 CSS 隐藏 `.sc-page-head__main`（其余页面只保留右上操作区，与 QuickNav 同行，绝对定位）。
- **仪表盘是唯一恢复标题区的页面**：`.sc-page-head--dashboard .sc-page-head__main` 恢复显示，`.sc-page--dash` 取消 46px 顶部预留与绝对定位，标题回到文档流。
- 仪表盘标题区：左侧 `工作台`（23px/600）+ 副标题「产品、工艺与客户询价的运营概览」+ 最近成功刷新时间；右侧 `新建产品`（主按钮 36px）、`上传素材`、`处理新询价`（描边按钮）、刷新图标按钮（34px 点击区）。

### 4.3 移动端（≤1024px）

- 隐藏侧栏，顶栏出现菜单按钮与搜索图标；搜索框收进可展开的搜索栏。
- 菜单打开左侧 Drawer，按模块分组列出全部页面，选择后自动关闭。
- 仪表盘标题区纵向排列，操作按钮自然换行，不遮挡标题。

### 4.4 登录页

- ≥1025px：左侧品牌区 + 右侧白色表单区；≤1024px：隐藏大图区，表单居中。
- 表单字段：用户名、密码（可显示/隐藏）、图形验证码、记住登录 30 天。

---

## 5. 页面构图

| 页面 | 构图 |
|---|---|
| 仪表盘 | 四指标卡 → 内容资产概览(58%)+待处理事项(42%) → 最近询价(58%)+最近更新产品(42%)；QuickNav 隐藏、标题区可见 |
| 产品管理 | 图片目录 / 紧凑表格双视图 + 分类/状态筛选 + 分页 + 精选/复制/删除 |
| 产品编辑 | 白色编辑 sheet：基本信息/描述/规格/图片视频/SEO + 右侧发布设置 |
| 分类管理 | 汇总条 + 目录表格 + 新建/编辑弹窗 + 删除迁移/停用流程 |
| 媒体库 | 上传条 + 响应式素材网格 + 大图/侧栏预览；ALT/替换/URL/删除 |
| 工艺管理 | 作品集卡片（封面、标题、摘要、状态、排序、操作） |
| 页面管理 | 分隔式 CMS 列表（标题、Slug、状态、更新时间） |
| 首页内容 | 左侧分区导航 + 中间分区表单 + 右侧实时首屏预览 |
| 询价管理 | 桌面双栏 Inbox（列表 + 详情/事件时间线）；≤980 列表/详情切换 |
| 站点设置 | 说明列 + 字段列的分组设置页 |
| 审计日志 | 信息密集、只读的最近 200 条日志表 |

**仪表盘细节规格：**

- 指标卡：4 列等宽（gap 14px），高 144px，内边距 18–20px；图标底板 36×36 浅色圆角方形；数值 32px/600 tabular；底部说明行 + 语义色进度条（绿色=发布占比，蓝色=工艺发布占比）；可点击卡 Hover 上移 ≤2px，Active scale 0.99。
- 内容资产概览：分组标题+总数 / 6–7px 比例条（绿=已发布、琥珀=草稿、灰=归档、蓝=工艺已发布、浅蓝=未发布）/ 紧凑图例；总数为 0 显示空轨道，不出 NaN。
- 待处理事项：行高 58px，图标底板 34×34，状态色（询价=珊瑚红、草稿=琥珀、工艺=蓝），列表顶对齐（`justify-content: flex-start`），1px 分隔线，数量 tabular，零值中性灰。
- 最近询价：表头 42px 浅灰底，行高 56px，客户名突出、公司/产品次级省略、状态标签统一、新询价红点+文字双通道、时间 tabular。
- 最近更新产品：行高 62px，缩略图 40×40 `object-fit: cover` 圆角 8px，名称 600/SKU 等宽/状态标签右对齐。
- 底部两栏 `align-items: stretch` 等高拉伸，数据行保持固定行高不随面板拉伸。

---

## 6. 组件规范

### 6.1 侧栏与顶栏

- 侧栏 Hover：`rgba(255,255,255,0.06)`；选中：`#E8EAED` 黑底浅色反转文字，不推挤布局。
- 顶栏搜索：真实查询，结果分组为产品 / 询价；Ctrl+K 聚焦。
- 通知铃：Badge 显示真实新询价数量，点击进入 `询价管理?status=new`。
- 账户菜单：管理员、修改密码、退出登录。

### 6.2 按钮

- 主按钮：黑色实底、白字、高 36–38px（仪表盘头部 36px），AntD Token 管理。
- 次级按钮：白底 + 1px 低对比度边框 `#C9CDD3`（深色 `#3A423E`）；**禁止通过全局 CSS 给所有按钮强制黑色边框**。
- 轻操作：文字按钮或无边框图标按钮（`.sc-icon-btn` 34px 点击区）；危险操作仅在危险场景用红。
- 按压反馈 scale 0.97–0.99；Hover 不改变布局。
- 图标统一使用 `@ant-design/icons`，不用 emoji。

### 6.3 状态标签

统一高度 22px 药丸、文字 + 颜色双通道，绝不只用圆点：

| 业务 | 状态 | 色 |
|---|---|---|
| 产品 | draft / published / archived | 琥珀 / 绿 / 灰 |
| 工艺 | draft / published / hidden | 琥珀 / 绿 / 灰 |
| 询价 | new / following / replied / completed / spam | 珊瑚 / 蓝 / 绿 / 绿 / 灰 |
| 邮件 | pending / sent / failed / skipped | 琥珀 / 绿 / 红 / 灰 |

### 6.4 表格

- 表头 42–44px 浅灰底 `#F8F9FA`，12px / 500–600。
- 正文 13px；仪表盘数据行 54–60px；分隔线 `#EDF2EF`；Hover 背景 `#F0F2F4` 过渡 140ms。
- 移动端表格在容器内横向滚动，不允许整页溢出。

### 6.5 面板与卡片

- 面板：白底 + 1px `#E4E9E6` 边界 + 14px 圆角（`--sc-radius-lg`）+ 极轻阴影（`--sc-shadow-card`）。
- 面板头部 48–52px，标题 14px/600，右上轻量链接入口（`.sc-panel-link`）。
- 只有可点击卡片允许 Hover 上移 1–2px；普通信息卡不上浮。
- 不允许三层卡片嵌套，不允许为所有卡片配装饰图标。

### 6.6 空 / 错 / 加载

- 空状态：线性图标 + 标题 + 一句说明 + 真实下一步（`EmptyState`）。
- 加载：与最终结构一致的 Skeleton（指标卡/面板/行骨架）。
- 错误：中文说明 + 真实重试（`PageError`），不泄露技术堆栈。

---

## 7. 动效

```css
--sc-motion-fast: 120ms;
--sc-motion-normal: 180ms;
--sc-motion-enter: 220ms;
--sc-ease: cubic-bezier(0.2, 0, 0, 1);
--sc-ease-enter: cubic-bezier(0.16, 1, 0.3, 1);
```

- 页面进入：透明度 0→1 + 垂直 4px，220ms（`sc-page-enter`）；指标卡组 220ms 逐个 45ms 延迟（`sc-stagger`）。
- 卡片/按钮 Hover 120–180ms；列表行 Hover 140ms；图标按钮按压 scale 0.97。
- 必须支持 `prefers-reduced-motion: reduce`（全局降级已内置）。
- 禁止：KPI 数值滚动、无意义循环动画、大幅弹跳、每次刷新重放入场动画。

---

## 8. 响应式断点

| 断点 | 行为 |
|---|---|
| ≥1440 | 完整侧栏、四列指标、中/底部两栏、内容最大 1520px |
| ≤1500 | 媒体网格 5→4 列 |
| ≤1400 | 产品目录 3 列 |
| ≤1200 | 媒体 3 列、工艺 2 列、指标 2 列 |
| ≤1100 | 仪表盘中/下区单列、编辑页侧栏转单列 |
| ≤1024 | 隐藏侧栏，启用顶栏菜单/搜索按钮 |
| ≤900 | 页面标题区列排 |
| ≤768 | 指标 gap 收窄、面板内边距 14px、产品 2 列 |
| ≤600 | 指标紧凑双列、询价表隐藏表头精简列 |

最低验收宽度：375 / 768 / 1024 / 1440。禁止整页横向溢出；触屏不能依赖 Hover。

---

## 9. 明确禁止的模式

1. 薄荷绿/深蓝大面积侧栏或模板色，AI 风格紫粉渐变、霓虹光效。
2. 把语义色当装饰：每张卡片涂一种颜色、进度条用黑色。
3. 通过全局 CSS 给所有 AntD 按钮强制黑色边框。
4. 没有品牌搜索/通知能力的模板式顶栏。
5. 三层卡片嵌套、每块内容都套完整矩形边框。
6. 虚假统计、虚假趋势、虚假上传进度、随机填充内容。
7. 在仪表盘重复渲染全量模块导航（侧栏/面包屑/QuickNav 三重重复）。
8. 用无数据依据的图表、空白或虚构记录凑版面。
9. 触屏设备把核心操作藏在 Hover 中。
10. 通过缩小所有字体解决移动端布局问题。

---

## 10. 文件落点

```text
web/admin-src/src/theme.ts                  AntD 6 Token（黑白主题）
web/admin-src/src/styles/admin.css          CSS Token / 布局 / 组件 / 响应式 / 动效
web/admin-src/src/layouts/AdminLayout.tsx   侧栏 + 顶栏 + QuickNav 路由判定 + 移动 Drawer
web/admin-src/src/components/
  BrandMark.tsx / GlobalSearch.tsx / PageHeader.tsx / PageSection.tsx
  StatusTag.tsx / EmptyState.tsx / PageLoading.tsx / PageError.tsx
  QuickNav.tsx（仅非仪表盘页面渲染）
web/admin-src/src/pages/                   业务页面（pages/dashboard 为仪表盘）
design-system/seamcap/MASTER.md            本文件
```

工程约束：

- TypeScript strict，不使用 `any`；不虚构数据结构。
- 不改变 Go 后端、API 契约、数据库或公开站样式。
- 不新增 UI/图表/动画依赖；图表由真实数据 + 轻量 CSS 实现。
- 组件必须连接真实业务，不能只做视觉样板。

---

## 11. 验证记录

- 2026-10-24 仪表盘精细化改造：`cd web/admin-src && npm run build`（tsc strict + vite）通过。
- 本轮改造范围：仪表盘标题区恢复、QuickNav 路由判定、指标卡语义色与结构对齐、任务列表顶对齐、底部面板等高拉伸、表格行高/缩略图规格、次级按钮低对比边框、动效 220ms/4px、`prefers-reduced-motion` 保持有效。
- 历史验证（Mintlight 时期）：Playwright 183 项 UI 检查 0 失败；`go test ./...` 通过；记录保留于 git 历史。

后续任何新页面必须先读本文件；若需改变侧栏、主色或页面框架，必须先更新本 Master，不能只在单页临时覆盖。
