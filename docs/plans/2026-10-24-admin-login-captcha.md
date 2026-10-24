# 管理后台登录图形验证码（2026-10-24）

## 目标

在管理后台登录页增加图形验证码，降低自动化撞库与暴力破解成功率。

## 做什么

- 后端新增 `internal/captcha`：4 位数字 PNG（132×44，噪点/干扰线/波浪扭曲），内存存储、5 分钟有效、一次性使用；签发与校验按 IP 限流。
- 新增 `GET /api/v1/admin/captcha`，返回 `{id, image(data URL), expires_in}`，`Cache-Control: no-store`。
- `POST /api/v1/admin/login` 新增 `captcha_id`、`captcha_code`，先校验验证码再校验密码；错误返回 400（字段 `captcha_code`），限流返回 429。
- 登录页增加验证码输入框与可点击刷新的图片；登录失败（含密码错误）自动换一张；验证码未加载时禁用登录按钮。
- 更新认证接口文档与安全说明。

## 不做什么

- 不引入第三方验证码服务/依赖（不接 reCAPTCHA、不引 OCR 库）。
- 不改公开询价表单、不改会话/CSRF 机制。
- 不做语音验证码、滑块验证。

## 设计要点

- 答案仅存服务端内存；接口不返回答案。挑战在任意一次校验后被删除（防重放），失败后前端自动刷新。
- 服务端限流：签发 60 张 / 5 分钟 / IP，校验 30 次 / 5 分钟 / IP；存储上限 5000 条，过期即清理。
- PNG 由标准库生成（`image/png`），数字字形为内置 5×7 点阵放大 4 倍，无新增依赖。

## 修改文件

- `internal/captcha/captcha.go`、`captcha_test.go`
- `internal/handler/admin/admin.go`（路由、登录校验、验证码接口）
- `cmd/server/main.go`（注入 Manager）
- `internal/itest/{itest_test,regression_test}.go`（登录辅助与验证码流程测试）
- `web/admin-src/src/{api/types.ts,context/AuthContext.tsx,pages/login/index.tsx,styles/admin.css}`
- `web/admin/`（构建产物）
- `docs/04-后端开发文档.md`

## 测试方案

- 单测：正确/错误答案、单次使用、过期、签发限流。
- 接口测试：无验证码 400、错误验证码 400、正确验证码 200、同一挑战不可复用。
- 构建：`npm run build`（tsc + vite）。
- 浏览器实测：验证码图片加载、点击刷新换图、错误提示、正确验证码登录进入仪表盘。

## 验收标准

- 登录必须提供有效验证码；验证码错误/过期返回 400 并提示刷新。
- 验证码图片在登录页正常显示，点击可换图，失败后自动换图。
- `go test ./...`、`go vet ./...`、`go build ./...`、`npm run build` 全部通过。
