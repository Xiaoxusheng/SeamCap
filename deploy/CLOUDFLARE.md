# Cloudflare 接入清单（免费版）

> 结论：**可以接，代码侧不需要改架构**。但有 4 处必须先处理，否则会出现「询盘限流全站共享」「大视频传不上去」「证书续签失败」这类难排查的故障。
> 本文按执行顺序排列，照做即可。

---

## 0. 开始前：本次已完成的代码侧改造

| 文件 | 改动 | 为什么必须 |
|---|---|---|
| `deploy/nginx/templates/default.conf.template` | 顶部新增 Cloudflare 真实 IP 还原（`set_real_ip_from` × 22 段 + `real_ip_header CF-Connecting-IP`） | **不配这个，全站访客在应用侧看起来都是同一个 CF 边缘 IP**。而 `RATE_LIMIT_INQUIRY_PER_HOUR=10` 是按 IP 计数的 → 第 11 个访客提交询盘就会被拒，且后台审计日志里全是 CF 的 IP |
| 同上 | 大视频上传处补充 CF 100MB 限制说明 | 免费版请求体上限 100MB，超限会被 CF 在边缘直接拦掉，**源站看不到任何日志**，极难排查 |
| `deploy/Caddyfile` | 新增全局 `trusted_proxies`（CF 网段） | Caddy 方案同理，否则 `X-Forwarded-For` 会被无条件采信，访客可伪造 IP 绕限流 |
| `docs/.env.example` | `MAX_VIDEO_MB` 与 `TRUSTED_PROXIES` 补充说明 | 避免运维误配 |

未接入 Cloudflare 时，以上改动**均无副作用**（不会误伤当前的直连部署）。

---

## 1. 接入顺序（顺序错了要返工）

```
① 域名 NS 改到 Cloudflare
        ↓
② 建 A 记录指向源站 IP，先保持「灰云」(DNS only)
        ↓
③ 验证 http/https 直连正常（此时还没走 CF）
        ↓
④ 源站装证书（方案 A 或 B，见第 3 节）
        ↓
⑤ A 记录点成「橙云」(Proxied)  →  SSL 模式设为 Full (strict)
        ↓
⑥ 验证站点 / 上传 / 询盘（见第 5 节）
        ↓
⑦ 最后收紧源站防火墙，只放行 CF 网段
```

**不要跳过 ③ 直接点橙云** —— 一旦橙云 + 证书不对，你会同时面对「CF 522 源站超时」和「重定向循环」，排查成本翻倍。

---

## 2. Cloudflare 面板逐项设置

### SSL/TLS

| 项 | 值 | 说明 |
|---|---|---|
| Encryption mode | **Full (strict)** | **绝对不要选 Flexible**。Flexible 下 CF→源站走明文 HTTP，而 nginx 的 80 端口是 301 跳 HTTPS → 无限重定向；且 HSTS 形同虚设 |
| Always Use HTTPS | 可开 | 源站 nginx 本来就在 80 上 301，效果一样。若保留 certbot 的 HTTP-01 校验，**必须关闭**（否则 ACME 请求被 301 打断，续签失败） |
| Minimum TLS Version | TLS 1.2 | 与 nginx 的 `ssl_protocols TLSv1.2 TLSv1.3` 对齐 |
| Automatic HTTPS Rewrites | 开 | 把站内残留的 http 链接改写 |

### DNS

- `shirunhat.com` → A → 源站 IP → **Proxied（橙云）**
- `www.shirunhat.com` → A 或 CNAME → 源站 IP / `shirunhat.com` → **Proxied**
- **所有子域都要橙云**。只要有一个 `mail.` `dev.` `ftp.` 走灰云，源站 IP 立刻暴露，前面所有功夫白做

### Speed / Cache

- Brotli：**开**
- HTTP/3 (QUIC)：**开**
- 0-RTT：开（有重放风险，纯展示站可接受）
- Early Hints：开
- Tiered Cache / Argo：免费版没有，跳过

**Cache Rules 建议两条：**

| 规则 | 匹配 | 动作 |
|---|---|---|
| 静态资源 | `URI Path starts with /uploads/` 或 `/static/` | Edge TTL 1 个月，Browser TTL 1 年（源站已发 `immutable`，CF 会沿用以 `Cache-Control` 为准） |
| 后台与接口 | `URI Path starts with /api/` 或 `/admin/` | **Bypass cache**（必须，避免后台数据被缓存后串号） |

> 源站 `web/admin/` 的构建产物文件名带哈希（如 `index-DzZr9jqV.js`），可以放心长缓存。

### Security

| 项 | 值 | 说明 |
|---|---|---|
| Security Level | Medium | 别一上来就 High/Under Attack，会误伤真实买家 |
| Bot Fight Mode | 开 | 免费版可用；会挑战可疑流量，注意观察 Search Console 的抓取情况 |
| WAF Managed Rules | 开（免费托管规则集） | 免费版提供基础规则，挡常见注入/扫描 |
| Rate Limiting | 建 **1 条**（免费版限额） | 见下方，优先保护登录口 |

**免费版唯一的限流规则，用在管理后台登录上：**

- 匹配：`URI Path contains /api/admin/login`
- 阈值：10 次 / 1 分钟 / 每 IP
- 动作：Block，持续 10 分钟

站点前台的询盘限流本来就有（应用层 `RATE_LIMIT_INQUIRY_PER_HOUR=10`），不需要占用这条 CF 规则。

### Network

- **Do not use TLS 1.3 for origin** —— 不用管，源站 certbot 默认 TLS 1.2/1.3 都开
- gRPC / WebSockets：本项目不用，跳过

---

## 3. 源站证书：两个方案，选一个

当前架构是 **certbot + HTTP-01 webroot**（`docker-compose.yml` 的 `certbot` 服务 + nginx 80 端口的 `/.well-known/acme-challenge/`）。
接入橙云后，这条链路的**脆弱点**是：CF 的 Always Use HTTPS 或安全规则可能把 ACME 校验请求 301/拦掉，导致静默续签失败。

### 方案 A：Cloudflare Origin Certificate（推荐）

一次装完，**15 年不用管**，certbot 可以退休。

1. CF 面板 → SSL/TLS → Origin Server → Create Certificate
2. 主机名填 `shirunhat.com` 和 `*.shirunhat.com`，有效期 15 年
3. 把证书和私钥保存为：
   - `certbot/conf/live/shirunhat.com/fullchain.pem`
   - `certbot/conf/live/shirunhat.com/privkey.pem`
4. `docker compose exec nginx nginx -s reload`
5. 停掉 certbot 相关 cron（如果配了）

> 路径复用现有挂载点，nginx 配置一行都不用改。**注意 Origin 证书只被 Cloudflare 信任**，一旦把 DNS 改成灰云直连，浏览器会报证书错误 —— 这正是它「锁定必须走 CF」的特性。

### 方案 B：保留 Let's Encrypt，改用 DNS-01

适合你希望证书不依赖 CF 的场景（比如以后可能撤掉 CF）。

```bash
# 在 certbot 容器里用 cloudflare 插件，凭 CF API Token（Zone.DNS 编辑权限）
docker compose run --rm certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/cf.ini \
  -d shirunhat.com -d '*.shirunhat.com'
```

需要把镜像换成带插件的版本（`certbot/dns-cloudflare`），并加一条自动续签的 cron：
`docker compose run --rm certbot renew --quiet && docker compose exec nginx nginx -s reload`

### 方案 C（不推荐）：继续 HTTP-01

仅在**关闭 CF 的 Always Use HTTPS** 且不加任何拦截规则时可行。省事但脆弱，一旦哪天在面板上开了个开关就会续签失败，而你通常要等 90 天后站点证书过期才发现。

---

## 4. 藏住源站 IP：必须做的 4 件事

「接了 Cloudflare 别人就查不到我 IP」是**错的**，下面每一环漏一个，IP 就白藏：

1. **源站防火墙只放行 CF 网段**（最关键，否则前功尽弃）

   ```bash
   # ufw 方案（改完立刻验证站点仍可访问）
   for ip in $(curl -s https://www.cloudflare.com/ips-v4); do ufw allow from "$ip" to any port 80,443 proto tcp; done
   for ip in $(curl -s https://www.cloudflare.com/ips-v6); do ufw allow from "$ip" to any port 80,443 proto tcp; done
   ufw deny 80/tcp && ufw deny 443/tcp   # 兜底：非 CF 来源一律拒绝
   ```

   > ⚠️ 执行前先开 SSH 白名单，别把自己关在门外。云厂商安全组做法同理。

2. **所有子域全橙云**，包括以后新增的
3. **源站不要跑邮件服务**：本项目用外部 SMTP 发询盘通知（`SMTP_HOST`），邮件头里不会带源站 IP —— 这点已经是对的，保持
4. **查历史泄露**：如果这个域名之前直接解析过源站 IP，它可能已被 SecurityTrails / Censys 收录。查一下，如果已收录，**换一个新的源站 IP 最彻底**（很多 VPS 支持免费换 IP）

另外：证书 CT 日志只记录域名、不记录 IP，所以 Let's Encrypt 签发不会泄露源站地址。

---

## 5. 验证清单（接入后逐条跑）

```bash
# 1) DNS 应返回 Cloudflare 的 IP（104.x / 172.6x），不是你服务器的 IP
dig +short shirunhat.com
dig +short www.shirunhat.com

# 2) 响应头应出现 CF 特征
curl -sI https://shirunhat.com | grep -iE "server|cf-cache-status|cf-ray"
#    server: cloudflare   cf-ray: xxxxx-HKG/LAX

# 3) 边缘节点信息（能访问说明橙云生效）
curl -s https://shirunhat.com/cdn-cgi/trace | grep -E "ip=|colo="

# 4) 静态资源应命中 CF 缓存
curl -sI https://shirunhat.com/static/css/main.css | grep -i cf-cache-status
#    期望 HIT；首次 MISS 正常

# 5) 接口不应被缓存
curl -sI https://shirunhat.com/api/products | grep -i cf-cache-status
#    期望 BYPASS 或不出现

# 6) 源站 IP 是否真的藏住了：直连 IP 访问 443，应当超时/拒绝
curl -sI --max-time 5 https://<源站IP> -k
#    期望 timeout / connection refused（说明防火墙生效）

# 7) 真实 IP 是否还原正确（最关键的一条）
#    用手机 4G 和公司网络各提交一次询盘，去后台 → 询盘列表，
#    两条记录的来源 IP 必须是两个不同的公网 IP，而不是同一个 CF 边缘 IP
```

第 7 条如果看到两个相同的、形如 `172.68.x.x` / `104.16.x.x` 的 IP，说明 `real_ip` 没生效 —— 检查 nginx 是否已 reload：`docker compose exec nginx nginx -t && docker compose exec nginx nginx -s reload`。

---

## 6. 免费版的能力边界（先说清楚，免得期待落空）

**能拿到：**

- 无限流量的 CDN 与缓存（图片/视频走 CDN，源站带宽通常能降 70–90%）
- 免费 Universal SSL（边缘证书，自动续期，访客看到的就是它）
- 免费 DNSSEC（在面板一键开启，无需去注册商填 DS，因为 NS 已经在 CF）
- 不限量 DDoS 防护
- 基础 WAF 托管规则集 + Bot Fight Mode
- **1 条** Rate Limiting 规则
- Brotli、HTTP/2、HTTP/3、Early Hints

**拿不到：**

| 限制 | 影响 | 应对 |
|---|---|---|
| **单请求体上限 100MB** | 大视频上传失败 | `.env` 设 `MAX_VIDEO_MB=90`；真需要大文件就传对象存储再外链 |
| **没有中国大陆节点** | 大陆访问会绕到香港/美西，反而**比直连慢** | 外贸站主客群在海外，可接受；自己在国内写后台会略慢，可给后台单独开 `admin.shirunhat.com` 并灰云（但注意第 4 节的 IP 暴露风险） |
| 无 Image Resizing | 不能靠 CF 动态裁图 | 源站已按 `?w=960` 做尺寸变体，够用 |
| 无 Argo / Tiered Cache | 跨洲回源延迟略高 | 源站选在客群所在洲（美国客群 → 美西机房） |
| 不代理非标准端口 | 8888 调试口无法走 CF | 只绑 `127.0.0.1`，本来也不该暴露（当前配置已经正确） |

---

## 7. 回滚

- **改回橙云 → 灰云**：5 分钟内全局生效，站点恢复直连（方案 A 的 Origin 证书会导致浏览器证书错误，需同时换回 LE 证书）
- **关掉 Bot Fight Mode / WAF**：即时生效
- **删缓存**：Caching → Purge Everything，30 秒生效

建议在正式对外推广前完成全部接入，避免流量进来后再折腾。
