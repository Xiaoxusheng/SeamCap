# 登录页“记住登录”与输入框尺寸（2026-10-24）

## 目标

缩小管理后台登录页输入控件，并增加“记住登录 30 天”选项，减少重复登录。

## 决策

“记住密码”不保存密码到浏览器。采用更安全的等价方案：

- 勾选后服务端会话 TTL 与 Cookie Max-Age 从 7 天延长到 30 天，Cookie 仍为 HttpOnly。
- localStorage 只保存用户名与勾选状态用于回填；密码由用户或浏览器密码管理器负责。
- 页面明确标注“不会保存密码”。

## 做什么

- 后端：`sessions` 表新增 `remember` 标记（迁移 0002）；登录入参新增 `remember`；新增 `REMEMBER_TTL_HOURS`（默认 720）；记住会话的滑动续期使用 30 天 TTL。
- 前端：用户名/密码/验证码输入框去掉 `size="large"`；验证码按钮 32px 高；登录按钮 38px；新增“记住登录 30 天”复选框；成功后写入/清除 localStorage 并回填。
- 测试：记住登录 TTL、滑动续期、Cookie Max-Age；浏览器实测输入框尺寸、勾选、登录、注销后回填。

## 不做什么

- 不把密码写入 localStorage/sessionStorage。
- 不改公开询价表单、不改验证码策略。

## 验收标准

- 未勾选时 Cookie Max-Age = `SESSION_TTL_HOURS`，勾选时 = `REMEMBER_TTL_HOURS`。
- 记住会话在临近过期续期后仍约为 30 天，不退回 7 天。
- 登录成功后重新打开登录页，用户名与勾选状态自动回填；localStorage 中无密码。
- 登录页输入框高度为 antd 默认（32px），验证码图片清晰可读。
