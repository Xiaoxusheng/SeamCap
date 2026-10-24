# SeamCap Admin · Design System Master

> **适用范围：** `web/admin-src/` 管理后台（Mintlight Enterprise Console）。
> **不适用：** 公开站 `design-system/shirun-luxe/`（独立视觉体系，请勿互相套用）。
>
> **方向决策（2026-10-24）：** 本工作区最终采用「浅薄荷绿侧栏 + 白色顶栏 + 浅灰绿工作区」的 Mintlight 方案。任务书最初提出的钴蓝顶部导航方案未采用，后续页面必须遵循本文件，而不是旧任务书或旧版设计稿。
>
> 新增或修改页面时先遵循本文件；若存在 `design-system/pages/[page-name].md`，仅允许覆盖该页面的构图，不得改变 Token、状态色、侧栏和顶栏结构。

**Project:** SeamCap
**Scope:** Admin console
**Updated:** 2026-10-24
**Status:** Implemented & verified（183 项 Playwright 检查 0 失败）

---

## 1. 设计理念

Mintlight Enterprise Console 是一个面向外贸帽饰工厂的轻量内容管理工作台：

- **Light & Precise** — 浅薄荷绿导航、白色顶栏、浅灰绿画布、1px 细边界；界面轻盈但不松散。
- **Content First** — 产品图、工艺封面与真实业务数据是主角，装饰退后。
- **Operational Clarity** — 侧栏负责模块切换，顶栏负责搜索/通知/账户，工作区按页面任务构图。
- **Semantic Color** — 薄荷绿品牌色 + 蓝/绿/琥珀/珊瑚等数据语义色；颜色只承担明确职责。
- **Quiet Motion** — 120–220ms 的微交互，不用大面积动画掩盖信息层级。
- **Real Business Only** — 所有指标、图表、列表与素材都来自真实接口，禁止假数据、假趋势、假进度。

---

## 2. 色彩 Token

所有颜色通过 `src/styles/admin.css` 的 CSS 变量或 AntD Theme Token 使用，禁止页面硬编码品牌色。

### 2.1 画布与表面

| Token | 值 | 用途 |
|---|---|---|
| `--sc-bg` | `#F5F9F8` | 工作区主画布 |
| `--sc-bg-soft` | `#F8FBFA` | 次级底色 |
| `--sc-surface` | `#FFFFFF` | 面板、表格、表单表面 |
| `--sc-surface-hover` | `#F6FAF9` | 行/卡片 Hover |
| `--sc-surface-selected` | `#E7F6F0` | 选中态底色 |
| `--sc-surface-muted` | `#F3F7F6` | 工具条、弱区域 |
| `--sc-border` | `#E4ECE9` | 1px 主边界 |
| `--sc-border-strong` | `#D5E1DD` | 控件/Hover 边界 |
| `--sc-border-soft` | `#EDF3F1` | 表格行、内部细线 |

### 2.2 文字

| Token | 值 | 用途 |
|---|---|---|
| `--sc-text` | `#202A2B` | 标题、正文 |
| `--sc-text-secondary` | `#5D6C6B` | 次级正文、标签 |
| `--sc-text-muted` | `#8B9997` | 说明、时间、辅助信息 |
| `--sc-text-disabled` | `#B4BEBC` | 禁用、占位 |

兼容旧页面的别名：`--sc-ink`、`--sc-ink-secondary`、`--sc-ink-muted`、`--sc-ink-disabled`。

### 2.3 品牌薄荷绿

| Token | 值 | 用途 |
|---|---|---|
| `--sc-primary` | `#199B78` | 主操作、当前导航、关键强调 |
| `--sc-primary-hover` | `#148665` | 主按钮 Hover |
| `--sc-primary-active` | `#0F7558` | 主按钮 Active / 深色文字 |
| `--sc-primary-soft` | `#E4F6EF` | 图标底板、选中浅底 |
| `--sc-primary-border` | `#C5E9DC` | 浅边框 |

### 2.4 数据语义色

| 语义 | Token | 值 |
|---|---|---|
| 信息 / 跟进 | `--sc-blue` / `--sc-blue-soft` | `#528DE8` / `#EAF2FF` |
| 成功 / 已发布 | `--sc-green` / `--sc-green-soft` | `#26A981` / `#E7F7F0` |
| 草稿 / 待处理 | `--sc-amber` / `--sc-amber-soft` | `#E6A23C` / `#FFF5E4` |
| 新询价 / 提醒 | `--sc-coral` / `--sc-coral-soft` | `#F07879` / `#FFF0F0` |
| 辅助数据 | `--sc-violet` / `--sc-violet-soft` | `#8A7CE0` / `#F2EFFF` |
| 归档 / 停用 | `--sc-gray` / `--sc-gray-soft` | `#84918F` / `#F0F3F2` |
| 危险 / 失败 | `--sc-danger` / `--sc-danger-soft` | `#D4615F` / `#FFF0F0` |

比例：70–80% 浅中性色，15–20% 文字与边界，5–10% 品牌与语义色。品牌绿只用于主操作和当前状态，不要把每个按钮都做成绿色。

### 2.5 导航专用

| Token | 值 |
|---|---|
| `--sc-nav-bg` | `#EDF8F4` |
| `--sc-nav-border` | `#E0EEE8` |
| `--sc-nav-text` | `#536763` |
| `--sc-nav-icon` | `#6D8880` |
| `--sc-nav-active-bg` | `#D6F1E7` |
| `--sc-nav-active-text` | `#168364` |

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
| 页面标题 | 24px / 600，字距 -0.015em | PageHeader h1（移动端 22px） |
| 面板标题 | 14px / 600 | 表格面板、区块标题 |
| 卡片标题 | 13–14px / 600 | 产品/工艺/媒体卡 |
| 正文 | 14px / 400，line-height 1.55 | 通用 |
| 表格正文 | 13px / 400 | 数据行 |
| 辅助说明 | 11–12.5px / 400 | 描述、时间、Hint |
| 指标数字 | 28–34px / 600 | 仪表盘指标 |
| Kicker | 11.5px / 600 | 页面模块标识（圆点前缀） |

- 数字使用 `font-variant-numeric: tabular-nums`（`.sc-tabular`）。
- SKU、Slug、文件名、IP、动作名使用等宽字体（`.sc-mono` / `.sc-code`）。
- 不靠全部加粗制造层级；正文 400，标题 600。

---

## 4. 布局与导航

### 4.1 桌面框架

```text
┌──────────────┬──────────────────────────────────────────────┐
│  SeamCap     │  搜索（Ctrl+K）        新询价 · 帮助 · 管理员 │ 58px 顶栏
│  Admin       ├──────────────────────────────────────────────┤
│              │                                              │
│  工作台      │  页面标题 / 描述 / 操作                      │
│  产品中心    │                                              │
│  素材与工艺  │  当前页面专属的指标、目录、表格、编辑器      │
│  网站内容    │                                              │
│  客户询价    │                                              │
│  系统管理    │                                              │
│              │                                              │
│  收起导航    │                                              │
└──────────────┴──────────────────────────────────────────────┘
  228px 浅薄荷绿侧栏
```

- 侧栏：228px，浅薄荷绿 `#EDF8F4`，粘性全高；收起后 68px，图标 + Tooltip。
- 顶栏：58px 白色，包含真实全局搜索（产品/SKU/询价，Ctrl+K）、新询价通知、帮助与快捷键、管理员菜单。
- 工作区：最大 1520px，左右留白 24px（≤1024 为 20px，移动端 16px）。
- 侧栏分组：工作台 / 产品中心 / 素材与工艺 / 网站内容 / 客户询价 / 系统管理；支持分组折叠与整体收起，收起状态持久化。
- 侧栏当前项：`#D6F1E7` 浅底 + `#168364` 文字 + 左侧细指示；键盘可用、`aria-current` 正确。

### 4.2 移动端（≤1024px）

- 隐藏侧栏，顶栏出现菜单按钮与搜索图标；搜索框收进可展开的搜索栏。
- 菜单打开左侧 Drawer，按模块分组列出全部页面，选择后自动关闭。
- 管理员菜单与修改密码仍在顶栏/Drawer 中可用。
- 禁止把桌面侧栏简单缩小冒充移动导航。

### 4.3 登录页

- ≥1025px：左侧浅薄荷绿品牌区（真实帽饰摄影 + 标题 + 三项能力说明），右侧白色表单区，表单内容最大 400px。
- ≤1024px：隐藏大图区，显示移动品牌行，表单在浅色画布上居中且保留完整验证码/记住登录。
- 表单字段：用户名、密码（可显示/隐藏）、图形验证码、记住登录 30 天；错误提示预留高度，不推跳整页。

---

## 5. 页面构图

| 页面 | 构图 |
|---|---|
| 仪表盘 | 指标网格 + 产品构成环形图 + 目录构成条 + 最近询价表 + 最近产品 + 待处理事项 |
| 产品管理 | 图片目录 / 紧凑表格双视图 + 分类/状态筛选 + 分页 + 精选/复制/删除 |
| 产品编辑 | 白色编辑 sheet：基本信息/描述/规格/图片视频/SEO + 右侧发布设置 |
| 分类管理 | 3 项真实汇总条 + 目录表格 + 新建/编辑弹窗 + 删除迁移/停用流程 |
| 媒体库 | 紧凑上传条 + 响应式素材网格 + 大图/侧栏预览；ALT/替换/URL/删除 |
| 工艺管理 | 作品集卡片（封面、标题、摘要、状态、排序、操作） |
| 工艺编辑 | 内容编辑 sheet：基本信息/正文/封面与视频/画廊/SEO + 发布侧栏 |
| 页面管理 | 分隔式 CMS 列表（标题、Slug、状态、更新时间） |
| 页面编辑 | HTML 编辑器 + 沙箱预览双栏（≤1100 上下排列） |
| 首页内容 | 左侧分区导航 + 中间分区表单 + 右侧实时首屏预览（≤1320 收起预览） |
| 询价管理 | 桌面双栏 Inbox（列表 + 详情/事件时间线）；≤980 列表/详情切换 |
| 站点设置 | 说明列 + 字段列的分组设置页；社交链接行编辑器 |
| 审计日志 | 信息密集、只读的最近 200 条日志表 |

**PageHeader：** 页面标题区不是卡片；由 kicker + h1 + 描述 + 页面级操作组成。编辑页使用 `variant="editor"`，与下方内容用细线分隔。

---

## 6. 组件规范

### 6.1 侧栏与顶栏

- 侧栏 Hover：`#E2F2EB` 浅底；选中：`#D6F1E7` + 深绿文字 + 细指示，不推挤布局。
- 顶栏搜索：真实查询，展示「搜索范围」，结果分组为产品 / 询价，空结果与加载态明确；Ctrl+K 聚焦。
- 通知铃：Badge 显示真实新询价数量，点击进入 `询价管理?status=new`。
- 帮助：Popover 说明快捷键、侧栏折叠与 Cookie 会话安全，不展示虚构信息。
- 账户菜单：管理员、修改密码、退出登录。

### 6.2 按钮

- 主按钮：薄荷绿底、白字、38px 高、8px 圆角（AntD Token）。
- 次级按钮：白底 + 1px 边界；文字按钮用于编辑/查看等轻量操作。
- 危险操作仅在删除/失败场景使用红色，并保留确认流程。
- 图标按钮 34px 点击区，统一 Ant Design 图标；按压 scale 0.97–0.98；Hover 不改变布局。

### 6.3 状态标签

统一高度约 22px、文字 + 颜色双通道，绝不只用圆点：

| 业务 | 状态 | 色 |
|---|---|---|
| 产品 | draft | 琥珀 |
| 产品 | published | 绿 |
| 产品 | archived | 灰 |
| 分类 | active / inactive | 绿 / 灰 |
| 工艺 | draft / published / hidden | 琥珀 / 绿 / 灰 |
| 询价 | new | 珊瑚 |
| 询价 | following | 蓝 |
| 询价 | replied / completed | 绿 |
| 询价 | spam | 灰褐 |
| 邮件 | pending / sent / failed / skipped | 琥珀 / 绿 / 红 / 灰 |

### 6.4 表格

- 表头高度 45px，浅灰绿底 `#F7FAF9`，字号 11.5px / 600。
- 正文 13px；单元格垂直内边距 9px，带缩略图的行情约 56–60px；分隔线 `#EDF3F1`。
- Hover 背景 `#F6FAF9`，过渡 140ms；操作收敛为「编辑 + 更多」。
- 加载使用行骨架；刷新时保留旧数据；空/错状态与全局组件一致。
- 移动端表格在容器内横向滚动，不允许整页溢出。

### 6.5 面板与卡片

- 面板：白底 + 1px `#E4ECE9` 边界 + 12px 圆角 + 极轻阴影。
- 只有可点击卡片允许 Hover 上移 1–2px 并提升一层阴影；普通信息卡不上浮。
- 产品/媒体图片使用稳定比例，Hover 只缩放图片约 1.03，不改变卡片尺寸。
- 媒体卡片操作工具栏默认在 Hover/键盘焦点出现；**触屏设备必须常显**（已有 `hover: none` 降级）。
- 空图使用统一线性占位，不随机填充图片。

### 6.6 表单

- Label 13px；帮助文字 12px；控件高度 38px；焦点环 3px 半透明品牌绿。
- 错误信息在字段下方出现，不推跳整页；长文本使用舒适行高。
- 所有字段名、校验规则和 payload 保持不变。

### 6.7 空 / 错 / 加载

- 空状态：线性图标 + 标题 + 一句说明 + 真实下一步。
- 加载：与最终结构一致的 Skeleton/行骨架；避免整页长时间转圈。
- 错误：中文说明 + 真实重试；不泄露技术堆栈。
- 成功反馈：轻量 message，不使用大面积绿色弹层。

---

## 7. 动效

```css
--sc-motion-fast: 120ms;
--sc-motion-normal: 180ms;
--sc-motion-enter: 220ms;
--sc-ease: cubic-bezier(0.2, 0, 0, 1);
--sc-ease-enter: cubic-bezier(0.16, 1, 0.3, 1);
```

- 页面进入：透明度 0→1 + 垂直 ≤4px，约 220ms；不让顶栏重复动画。
- 侧栏收起/展开：180ms 宽度过渡；文字不换行跳动。
- 导航 Hover：120ms 背景变化；选中态平滑，不推挤。
- 表格行 Hover：140ms 背景；不做整行缩放。
- 媒体图缩放：约 220ms，1.03 倍；容器尺寸稳定。
- 上传：拖入边框/底色 180ms 变化；真实上传状态，不伪造百分比进度。
- 必须支持 `prefers-reduced-motion: reduce`（已全局降级）。

---

## 8. 响应式断点

| 断点 | 行为 |
|---|---|
| ≤1500 | 媒体网格 4 列 |
| ≤1400 | 产品目录 3 列 |
| ≤1320 | 首页编辑器收起右侧预览 |
| ≤1200 | 媒体 3 列、工艺 2 列、设置说明列收窄 |
| ≤1100 | 仪表盘中/下区单列、编辑页侧栏转单列、页面编辑器上下排列 |
| ≤1024 | 隐藏侧栏，启用顶栏菜单/搜索按钮；登录页隐藏大图区 |
| ≤980 | 询价 Inbox 转列表/详情切换 |
| ≤900 | 页面标题列排、首页布局单列、CMS 列表精简列 |
| ≤768 | 产品 2 列、媒体 2 列、表单单列、设置分组单列 |
| ≤600 | 产品目录 1 列、媒体 2 列、指标网格 1 列（按 CSS 实际） |

最低验收宽度：375 / 768 / 1024 / 1440。禁止整页横向溢出；触屏不能依赖 Hover。

---

## 9. 明确禁止的模式

1. 深海军蓝 / 黑色全高侧栏，或与浅薄荷绿导航混用。
2. 没有品牌搜索/通知能力的模板式顶栏。
3. 所有页面固定「标题卡 + 筛选卡 + 表格卡」。
4. 所有页面机械复制同一款 PageHeader。
5. 把所有按钮和状态都做成同一种绿色/蓝灰色。
6. 三层卡片嵌套、每块内容都套完整矩形边框。
7. 用统一入场动画掩盖构图问题。
8. 虚假统计、虚假趋势、虚假上传进度、随机填充产品图。
9. 触屏设备把核心操作藏在 Hover 中。
10. 通过缩小所有字体解决移动端布局问题。

---

## 10. 文件落点

```text
web/admin-src/src/theme.ts                  AntD 6 Token（薄荷绿主题）
web/admin-src/src/styles/admin.css          CSS Token / 布局 / 组件 / 响应式 / 动效
web/admin-src/src/layouts/AdminLayout.tsx   侧栏 + 顶栏 + 全局搜索/通知/帮助 + 移动 Drawer
web/admin-src/src/components/
  BrandMark.tsx        品牌标记
  GlobalSearch.tsx     顶栏搜索（真实产品/询价）
  PageHeader.tsx       页面标题
  PageSection.tsx      内容分区
  StatusTag.tsx        语义状态标签
  EmptyState.tsx       空状态
  PageLoading.tsx      页面骨架
  PageError.tsx        错误状态
  TableSkeleton.tsx    表格行骨架
  MediaThumb.tsx       媒体缩略图
  GalleryEditor.tsx    图库编辑
  MediaPicker.tsx      媒体选择
  MediaIDField.tsx     媒体 ID 字段
  MediaURLField.tsx    媒体 URL 字段
web/admin-src/src/pages/                   业务页面
design-system/seamcap/MASTER.md            本文件
```

工程约束：

- TypeScript strict，不使用 `any`；不虚构数据结构。
- 不改变 Go 后端、API 契约、数据库或公开站样式。
- 不新增 UI/图表/动画依赖；图表由真实数据 + 轻量 SVG/CSS 实现。
- 组件必须连接真实业务，不能只做视觉样板。

---

## 11. 验证记录

- `cd web/admin-src && npm run build`：通过，产物输出到 `web/admin/`。
- Playwright + Edge 真实登录（HttpOnly Cookie + CSRF + 图形验证码 + 记住登录）：通过。
- 183 项 UI 检查：0 失败，覆盖 10 个内容页面 + 3 个编辑页 + 登录页、侧栏折叠、全局搜索、通知、帮助、产品视图切换、保存、媒体上传/预览、首页预览、页面沙箱、询价状态、设置保存。
- 1440 / 1024 / 768 / 375 四档宽度：无整页横向溢出。
- `go test ./...`：全部通过。
- 验收截图与报告：`tmp_verify/studio/shots4/`。

后续任何新页面必须先读本文件；若需改变侧栏、主色或页面框架，必须先更新本 Master，不能只在单页临时覆盖。
