# 后端安全审查修复（2026-10-25）

状态：已完成（2026-10-25）
来源：2026-10-25 后端安全扫描报告

## 目标

一次性修复扫描发现的可落地问题，保持现有架构与 API 不变。

## 做什么

1. 密钥与构建上下文
   - `.gitignore` / `.dockerignore` 忽略 `.deploy_ssh/`、`.deploy-tmp/`（含生产 SSH 私钥与本地凭据）。
2. 部署加固
   - docker-compose 的 8888 调试口收回到 `127.0.0.1`。
   - Nginx（容器模板 + 传统配置）与 Caddy 增加 HSTS；Nginx 关闭 `server_tokens`。
3. 应用安全头
   - 管理后台 SPA HTML 增加 CSP（内联主题脚本用 SHA-256 白名单）。
   - 管理 API 统一 `Cache-Control: no-store`。
4. 认证与输入加固
   - 公开询价 `product_id <= 0` 返回 400，不再触发外键 500。
   - 询价 `User-Agent` 截断 500 字符。
   - `writeAuthError` 改用 JSON 编码，消除手拼注入隐患。
   - Argon2 校验增加全局并发上限；登录/改密限流 map 改为按过期淘汰，避免整表重置。
   - 登录失败写入审计；改密失败限流。
5. 权限与邮件
   - data 目录 0700、SQLite 主库/WAL/SHM 0600、备份文件 0600；备份脚本 umask 077。
   - SMTP `starttls` 在服务器不支持时快速失败。
6. 依赖
   - Go 工具链/构建镜像升级到 1.27.3（GO-2026-6809）。

## 不做什么

- 不改认证模型、不引入多管理员/角色、不引入 Redis 等外部组件。
- 不重构限流为分布式方案（保持单实例内存限流 + 清理策略）。
- 不修改现有 API 路径、响应结构、数据库 schema。
- 不轮换 SSH 密钥（需用户确认并在服务器侧操作，本次只做忽略与隔离）。
- 不改前端业务逻辑与 UI。

## 修改文件

- `.gitignore`、`.dockerignore`、`docker-compose.yml`、`Dockerfile`、`go.mod`
- `deploy/nginx/templates/default.conf.template`、`deploy/nginx.conf`、`deploy/Caddyfile`、`deploy/backup.sh`
- `cmd/server/main.go`（admin SPA CSP）
- `internal/middleware/middleware.go`、`internal/middleware/auth.go`
- `internal/handler/admin/admin.go`
- `internal/service/auth.go`、`internal/service/inquiry.go`
- `internal/email/email.go`
- `internal/repository/db.go`、`internal/secret/secret.go`
- 测试：`internal/service/inquiry_test.go`、`internal/middleware/middleware_test.go`、`cmd/server/main_test.go`（新增）

## 测试方案

- `gofmt -w` → `go vet ./...` → `go test ./...` → `go test -race ./...` → `go build ./...`
- `govulncheck ./...` 确认 GO-2026-6809 消失
- 隔离实例 + 浏览器打开 `/admin/`，确认登录页在 CSP 下正常渲染、无 console CSP 报错
- 动态复测：product_id=-1 → 400；未登录 admin → 401；路径穿越 → 404；admin 响应 no-store

## 风险

- CSP 过严可能阻断管理后台内联主题脚本或外部媒体预览：用 SHA-256 放行主题脚本，img/media 放行 https。
- 收紧 data 目录权限可能影响以其他用户运行的备份脚本：应用与备份须以同一用户/root 运行（现有 systemd/容器均满足）。
- Go 1.27.3 工具链需可下载；生产构建镜像已固定补丁版本。

## 验收标准

- 上述动态复测全部符合预期，完整测试通过，无新增 govulncheck 可达漏洞。
- 工作区原有未提交改动不被回滚。
