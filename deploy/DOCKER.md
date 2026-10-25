# SeamCap Docker 部署指南

## 0. 镜像结构

三阶段多阶段构建（`Dockerfile`）：

| 阶段 | 基础镜像 | 做什么 |
|---|---|---|
| 1 | node:22-alpine | `npm ci && npm run build` 构建管理后台 SPA → `web/admin` |
| 2 | golang:1.27-alpine | `CGO_ENABLED=0` 编译 Go 后端（纯 Go SQLite，静态二进制） |
| 3 | alpine:3.20 | 运行时：非 root 用户 `seamcap`，仅含二进制 + web + migrations |

数据目录通过卷挂载持久化，**不在镜像内**：
- `/app/data` → 宿主 `./data`（SQLite 库、secret.key、备份）
- `/app/uploads` → 宿主 `./uploads`（图片/视频）

## 1. 服务器准备

```bash
# 安装 Docker Engine + compose 插件（以 Ubuntu/Debian 为例）
curl -fsSL https://get.docker.com | sh
sudo systemctl enable --now docker
```

## 2. 上传代码

推荐 git；或 rsync（自动跳过 .gitignore 里的垃圾文件）：

```bash
rsync -av --exclude-from=.gitignore --exclude .env ./ user@server:/opt/seamcap/
```

## 3. 配置 .env

在服务器项目根目录创建 `.env`（可从本地 `.env` 复制后改），关键字段：

```ini
DOMAIN=shirunhat.com               # 主域名，不带 https:// 不带 www（nginx 证书/反代用）
BASE_URL=https://shirunhat.com     # 影响链接生成与 sitemap
INITIAL_ADMIN_USER=admin
INITIAL_ADMIN_PASSWORD=首个管理密码   # 首次启动自动建号，登录后立即改
# 邮件（询盘通知）
SMTP_HOST=smtp.xxx.com
SMTP_PORT=465
SMTP_USER=...
SMTP_PASS=...
NOTIFY_EMAIL=收件邮箱
SMTP_TLS=ssl
```

其余项（SESSION_TTL、限流、上传上限等）有默认值，按需覆盖。

前提：域名 A 记录已解析到服务器 IP（根域名 + www 两条）。
防火墙/安全组放行 **80、443**（另有 8888 为应用直连调试口，可按需关闭）。

## 4. 首次启动（含 HTTPS 证书签发）

```bash
cd /opt/seamcap
export DOMAIN=shirunhat.com   # 与 .env 中 DOMAIN 一致

# 1) 生成占位自签证书（让 nginx 能先启动，稍后被正式证书覆盖）
mkdir -p certbot/conf/live/$DOMAIN certbot/www
openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
  -keyout certbot/conf/live/$DOMAIN/privkey.pem \
  -out  certbot/conf/live/$DOMAIN/fullchain.pem \
  -subj "/CN=$DOMAIN"

# 2) 启动全部（app 构建较慢，第一次 3~5 分钟）
docker compose up -d --build
docker compose logs -f app      # 看到 "server started" 即成功
curl -s http://127.0.0.1:8888/robots.txt   # 本机探活

# 3) 签发正式证书（HTTP-01 校验走 nginx 80 端口，全程不停机）
docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
  -d $DOMAIN -d www.$DOMAIN \
  --email 你的邮箱 --agree-tos --no-eff-email

# 4) 重载 nginx 启用正式证书
docker compose exec nginx nginx -s reload
```

完成后访问 `https://shirunhat.com` 即为正式站（80 自动 301 到 443，www 自动 301 到根域名）。

若宿主机 `./data`、`./uploads` 已存在且属于某个普通用户，需放开容器写权限：
在 `docker-compose.yml` 里打开 `user: "uid:gid"`（改成 `stat -c '%u:%g' data` 的输出）。

> 暂时没有域名、只想先跑 HTTP？跳过第 1、3、4 步，只执行
> `docker compose up -d --build app`（单起 app 服务），用 `http://服务器IP:8888` 访问。

## 5. HTTPS 架构与证书续签

架构：`用户 → Nginx 容器(80/443, TLS) → app 容器(内网 8080)`。
Nginx 配置由 `deploy/nginx/templates/default.conf.template` 渲染（域名取自 `.env` 的 `DOMAIN`），
主要行为：80 全部 301 到 443；www 301 到根域名；`client_max_body_size 520m` 支持大视频上传。

证书续签（Let's Encrypt 90 天有效期），加 crontab 每周自动续：

```bash
crontab -e
# 每周一 03:00 续签并重载 nginx（webroot 模式不停机）
0 3 * * 1 cd /opt/seamcap && docker compose run --rm certbot renew --webroot -w /var/www/certbot --quiet && docker compose exec -T nginx nginx -s reload
```

手动验证：`docker compose run --rm certbot renew --dry-run`。

## 6. 日常运维

```bash
docker compose ps                 # 状态（healthy 为探活通过）
docker compose logs -f app        # 跟日志
docker compose restart app        # 重启

# 发新版
git pull
docker compose up -d --build      # 数据在卷里，不受影响

# 备份（容器内也启用了 backup.sh 可用路径：/app/data）
tar czf seamcap-$(date +%F).tgz data/uploads data/seamcap.db*
```

> 注意：SQLite WAL 模式下请用 `deploy/backup.sh` 或先停写再拷库文件；备份目录在 `data/backups`。

## 7. 常见问题

- **启动报 open database failed**：宿主 `./data` 属主与容器用户不匹配 → 见第 4 步的 `user:` 配置。
- ** healthcheck 一直 unhealthy**：`docker compose logs app` 看是否端口/配置错误。
- **nginx 起不来报证书找不到**：没做第 4 步的占位自签，或 `.env` 的 `DOMAIN` 与签发时用的域名不一致。
- **compose 报 "请先在 .env 中设置 DOMAIN"**：`.env` 里补 `DOMAIN=你的域名`。
- **换端口**：app 直连调试口改 compose 里 `ports` 左侧即可；对外端口恒为 80/443（nginx）。