# 管理后台 UI 重设计 · Mintlight Enterprise Console

日期：2026-10-24
状态：实施中
设计方向：**Mintlight Enterprise Console（薄荷绿现代企业工作台）**

## 目标

按最新视觉基线彻底重做 `web/admin-src/` 管理后台视觉与布局，替换工作区中上一版「钴蓝顶栏 + 横向模块导航」方案：

- 浅薄荷绿左侧导航 + 白色顶部工具栏 + 浅灰绿主工作区。
- 统一薄荷绿设计 Token、字体层级、圆角、边框、阴影与状态色。
- 14 个后台页面逐页重新组织布局与信息层级，不是统一换色。
- 仪表盘使用真实 `DashboardData` 做指标卡、产品状态环形图、目录构成与最近业务。
- 产品管理突出真实图片目录；媒体库使用素材网格与大图预览；询价改为双栏客户工作台。
- 完整落地页面进入、按钮、菜单、卡片、表格行、图片、弹窗、上传/表单 8 类微交互。
- 保持 React 18 + TS + Vite + Ant Design 6 技术栈，不引入新依赖，不改 Go 后端、API 契约与认证。

## 当前实现（本次改造前）

- 工作区未提交版本为「SeamCap Studio」钴蓝顶栏方案：68px 横向主导航 + 44px 模块上下文条 + 钴蓝 `#3B5BDB` 品牌色。
- 页面业务逻辑完整（真实 API、CSRF、上传、媒体引用冲突、询价跟进），但视觉方向与本次参考不一致。
- 工作区同时存在其他 agent 的后端未提交修改；本次仅改 `web/admin-src/`、构建产物 `web/admin/` 与设计文档。

## 做什么

1. **设计系统**：重写 `theme.ts` 与 `styles/admin.css`；薄荷绿 Token、13–14px 正文、等宽数字、9–12px 卡片圆角、轻边框轻阴影；AntD 组件统一 Button/Input/Select/Table/Card/Tabs/Form/Modal/Drawer/Tag/Upload/Pagination/Tooltip/Empty/Skeleton。
2. **整体布局**：重写 `AdminLayout` 为可折叠浅薄荷绿左侧导航（228px / 68px）+ 白色 58px 顶栏 + 浅色工作区；移动端抽屉导航；顶栏含真实范围搜索（产品/SKU/询价）、帮助、新询价提醒、管理员菜单。
3. **页面标题**：`PageHeader` 改为无卡片轻头部，标题 / 描述 / 操作右对齐。
4. **登录页**：薄荷绿品牌侧 + 真实帽饰摄影 + 白色表单区；保留验证码、记住登录、401 提示、防重复提交。
5. **仪表盘**：4 张核心指标卡（已发布/草稿/工艺/新询价）+ 目录构成（含归档）+ 产品状态 SVG 环形图 + 最近询价 / 最近更新产品 / 待处理事项；全部使用真实数据。
6. **产品**：图片目录 3–4 列 / 紧凑表格双视图、筛选栏、精选、复制、删除、分页与 URL 参数保持；编辑页按基本信息、描述、规格定制、主图图库、视频、SEO 分区，右侧发布设置。
7. **分类**：统计条 + 紧凑表格 + 新建/编辑弹窗 + 删除迁移/停用流程。
8. **媒体**：上传区、4–5 列素材网格、悬停工具条、图片/视频预览与属性侧栏、ALT/替换/删除/引用冲突。
9. **工艺**：作品集卡片列表；编辑页分区（基本信息、正文、封面图库、视频、SEO）。
10. **网站内容**：页面 CMS 列表 + 编辑器/沙箱预览；首页左侧分区导航 + 中部表单 + 右侧真实数据预览。
11. **询价**：桌面双栏 Inbox（列表 360px + 详情），移动端列表/详情切换；保留筛选、备注、状态、重发、删除、导出、`?inquiry=` 直达。
12. **设置/审计**：分组设置 + 两列字段 + 社交链接行编辑；紧凑审计表。
13. **动效与响应式**：页面淡入、按钮/菜单/卡片/行/图片/弹窗/上传反馈；375 / 768 / 1024 / 1440 四档；`prefers-reduced-motion` 降级。
14. **验证与文档**：`npm run build` 产出到 `web/admin/`；8091 临时实例浏览器实测；`go test ./...`；重写 `design-system/seamcap/MASTER.md`。

## 不做什么

- 不改 Go 后端业务、API Contract、数据库、迁移、公开站页面。
- 不新增业务路由、不引入新 UI / 图表 / 动画依赖、不虚构指标或趋势。
- 不做暗色模式（当前无此需求）。
- 不触碰工作区已有后端与其他 agent 的未提交修改。
- 不删除任何现有业务操作或降低安全行为（登录、CSRF、上传校验、删除确认）。

## 关键技术方案

- Token：画布 `#F5F9F8`、表面 `#FFFFFF`、品牌 `#199B78`、正文 `#202A2B`、次级 `#5D6C6B`、边界 `#E4ECE9`；蓝/绿/琥珀/珊瑚/紫/灰只做状态与数据色。
- 导航：`EDF8F4` 底、`D6F1E7` 选中底、`#168364` 选中文字；分组标题 11px；折叠保留 Tooltip；状态持久化 localStorage。
- 顶栏搜索：实时请求 `/admin/products?q=` 与 `/admin/inquiries?q=`（防抖 280ms，最多 5+4 条），Enter 跳转产品搜索；不伪造全站搜索。
- 图表：仅用内联 SVG 环形图与 CSS 进度条，不新增图表库。
- 动效：fast 120ms / normal 180ms / enter 220ms；标准缓动 `cubic-bezier(.2,0,0,1)`。
- 响应式断点：1200 / 1024 / 900 / 768 / 560。

## 修改文件

```text
web/admin-src/src/theme.ts                    重写
web/admin-src/src/styles/admin.css            全量重写
web/admin-src/src/layouts/AdminLayout.tsx     全量重写
web/admin-src/src/components/GlobalSearch.tsx 新增
web/admin-src/src/components/BrandMark.tsx    配色
web/admin-src/src/components/PageHeader.tsx   轻头部
web/admin-src/src/pages/**                    逐页调整/重构
web/admin-src/index.html                      标题
design-system/seamcap/MASTER.md               全量重写
web/admin/**                                  构建产物
```

## 验证方案

1. `cd web/admin-src && npm run build` 零 TypeScript / 构建错误，产物写入 `web/admin/`。
2. 复用 8091 临时实例（独立数据库副本）浏览器实测：登录、仪表盘、产品双视图与编辑、分类、媒体预览、工艺、页面编辑、首页、询价双栏、设置、审计。
3. 1440 / 1024 / 768 / 375 检查横向溢出、侧栏折叠、表格滚动、移动端列表/详情切换。
4. 检查控制台错误、键盘焦点、reduced-motion、空/错/加载态。
5. `go test ./...` 回归（工作区已有后端改动，仅报告结果）。

## 风险

- 工作区多 agent 并行：每次编辑前重读目标文件，不覆盖他人改动。
- AntD 6 组件 API 以本地 `node_modules` 类型为准。
- 登录验证码需目视识别；验证实例使用独立数据库，不影响现有数据。
