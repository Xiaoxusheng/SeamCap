# SeamCap — 义乌无痕棒球帽源头工厂外贸独立站

B2B 产品展示官网（Go + SQLite + 原生 HTML/CSS/JS）。不含购物车、支付与订单系统。

## 文档导航

| 文档 | 内容 |
|------|------|
| [docs/01-安装文档.md](docs/01-安装文档.md) | ui-ux-pro-max skill 安装记录、开发环境安装、本地运行 |
| [docs/02-开发文档.md](docs/02-开发文档.md) | 项目概述、架构、数据库总览、API 概览、四阶段开发计划、测试与部署 |
| [docs/03-前端开发文档.md](docs/03-前端开发文档.md) | 原生前端规范、设计系统（design tokens）、页面结构、交互与 SEO 实现 |
| [docs/04-后端开发文档.md](docs/04-后端开发文档.md) | Go 分层架构、数据库 DDL、REST API 定义、认证/安全/邮件/存储/部署 |
| [docs/05-管理后台开发提示词.md](docs/05-管理后台开发提示词.md) | 管理后台（antd 6）实现提示词：技术栈、认证流、逐页 API 映射、验收标准 |

## 管理后台

入口：`http://localhost:<PORT>/admin/`（React 18 + antd 6，源码 `web/admin-src/`，构建产物 `web/admin/`）。

```bash
# 前端开发（热更新，代理 /api → :8080）
cd web/admin-src && npm install && npm run dev
# 前端构建（输出 web/admin，由 Go 服务托管）
npm run build
```

## 关键目录

- `design-system/seamcap/MASTER.md` — 设计系统唯一事实来源（ui-ux-pro-max skill 生成）
- `.codebuddy/skills/` — 已安装的 UI/UX 设计技能（含 ui-ux-pro-max 主技能）
- `docs/` — 本套项目文档

## 快速开始

```bash
cp docs/.env.example .env   # 按需修改（根目录已有本地开发 .env）
go run ./cmd/server         # 默认 :8080，迁移自动执行
go test ./...               # 全部测试
go build -o bin/seamcap.exe ./cmd/server
```

后端已实现：公开 API + 管理 API（会话认证/CSRF/限流）、14 表 SQLite 迁移、媒体上传（magic number 校验）、询价+异步邮件通知、sitemap/robots。详见《04-后端开发文档》。
