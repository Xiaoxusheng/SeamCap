# 后端 Bug 修复计划（2026-10-24）

## 目标

修复本轮后端扫描确认的缺陷，重点是不损坏用户上传内容、堵住可被未认证请求利用的安全问题。

## 做什么

1. 修复 `storage.writeStream` 对 JPEG/PNG 的重复写入（P0，已导致现有上传图片损坏）。
2. 媒体替换改为写新文件名并删除旧文件，使 `Cache-Control: immutable` 不再导致替换不生效。
3. `ClientIP` 仅信任受信代理网段，从右向左取首个非受信地址；`SameOrigin` 改为精确 Host 比较。
4. 邮件头统一去除 CR/LF；询价 `name` 拒绝换行，防 SMTP 头注入。
5. 上传超时调整；修正 Caddy 静态/上传路径；`pathID` 400、`Decode` 413、内部错误落日志、`/health` DB 异常 503、`test-email` 可读错误。
6. HTML 过滤改为基于 `golang.org/x/net/html` 的标签/属性/URL 白名单。
7. 中文名 slug 使用 `category-`/`craft-`/`product-` 前缀兜底；空列表统一返回 `[]`。
8. 补充回归测试（大图完整性、XFF、同源、邮件头、绕过用例、空列表）。

## 不做什么

- 不改动数据库 schema、现有 API 路径与前端调用契约。
- 不重构分层架构，不引入 S3/对象存储。
- 不处理并发 agent 已修复的 `media.go`/`home.go` 内容。
- 不改动前台 SSR 与 UI 设计。

## 修改文件

- `internal/storage/encode.go`、`storage.go`、`storage_test.go`
- `internal/service/media.go`、`inquiry.go`、`page.go`、`product.go`、`category.go`、`craftsmanship.go`、`home.go`、`dashboard.go`
- `internal/middleware/middleware.go`、`auth.go`（+ 新增测试）
- `internal/email/email.go`（+ 新增测试）
- `internal/handler/respond.go`、`internal/handler/admin/admin.go`、`internal/handler/public/public.go`
- `internal/apperr/apperr.go`
- `internal/config/config.go`、`cmd/server/main.go`
- `deploy/Caddyfile`

## 测试方案

- `go test ./...`、`go vet ./...`、`go build ./...`
- 上传：保存 300×300 随机 PNG，断言落盘字节与输入完全一致、尺寸正确
- 安全：XFF 伪造、SameOrigin 绕过、邮件 Subject 注入、HTML 过滤绕过用例
- 端到端：`go test ./internal/itest`，并复扫 `uploads/` 历史图片

## 风险

- 存量已损坏图片无法自动恢复，需重新上传或从备份恢复（本次不处理数据修复）。
- 受信代理默认包含回环与私有网段；若部署在公网直连且未配置 `TRUSTED_PROXIES`，行为退化为直接取 RemoteAddr（仍是安全默认）。
- HTML 过滤输出可能与旧内容有格式归一化差异（标签/属性白名单内保留）。

## 验收标准

- 大图上传后 `size_bytes == 实际文件字节数`，图片可解码，内容逐字节一致。
- 伪造 XFF 无法改变登录/询价限流键；跨源 Origin 一律 403。
- 带 CRLF 的 name 被拒绝；邮件 Subject 不含 CR/LF。
- 非法路径 id 返回 400；超大 JSON 返回 413；内部错误有日志。
- 所有测试通过，`go vet` 无输出。

## 补充（第二轮，2026-10-24 晚）

在上述修复完成后继续处理残留问题：

- 长度校验改为按 rune 计数：产品/分类/工艺/页面/询价/首页/设置/媒体 alt 与文件名，避免中文内容在 1/3 字符数就被拒绝；截断改为 rune 安全。
- 工艺 SEO 字段、首页 hero/CTA/正文、分类英文名补齐后端长度校验（与前端 maxLength 对齐）。
- 上传 multipart 超限返回 413（原来 500）；缺失文件返回 400；替换媒体时的 FormFile 错误不再静默忽略。
- 媒体删除改为先删数据库记录、后删文件，避免“记录在、文件没了”。
- 询价通知 goroutine 增加 panic 恢复；首页单行记录首次创建改为 `INSERT OR IGNORE`。
- 登录接口增加同源校验（登录 CSRF 防御）；`/health` 在 DB 异常时 body 返回 degraded。
- 商品复制在 100 个候选 slug 全部占用时返回 409，而不是触发唯一约束 500。
- 新增测试：中文长度边界、multipart 超限 413、跨源登录 403。

## 补充（第三轮，2026-10-24 晚）

- 联表查询补齐 `m.id`：产品主图、分类图、工艺封面、首页 hero 的内嵌媒体对象不再返回 `id: 0`，与 `*_image_id` 一致。
- 新增 `TestJoinedMediaIDs` 覆盖管理/公开详情与列表；并用真实 HTTP 栈验证 7 个接口返回的媒体 id 均正确。
