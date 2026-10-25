#!/usr/bin/env bash
# ============================================================================
# SeamCap 一键部署脚本（通用）
# 流程：本地交叉编译 Linux 二进制 → 上传二进制/迁移/前端静态 → 服务器重建
#       Docker 镜像并重启 → 健康检查
# 用法：
#   bash deploy/deploy.sh                # 完整部署（默认目标 xyx.homes）
#   SEAMCAP_SERVER=root@other.host SEAMCAP_DIR=/opt/seamcap bash deploy/deploy.sh
# 依赖：ssh/scp 免密登录（公钥须已加到服务器 authorized_keys）、Go、tar、curl
# 任何一步失败立即中止（不做部分部署、不误报成功）
# ============================================================================
set -euo pipefail

SERVER="${SEAMCAP_SERVER:-root@xyx.homes}"
DIR="${SEAMCAP_DIR:-/opt/seamcap}"
URL="${SEAMCAP_URL:-https://xyx.homes:8890}"
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new)

cd "$(dirname "$0")/.."
# Windows 用户名含中文时 %USERPROFILE% 会被按 ANSI 误转，known_hosts/密钥读取不稳定；
# 项目内 .deploy_ssh/（ASCII 路径）存在时优先使用。
if [ -f .deploy_ssh/id_ed25519 ]; then
  SSH_OPTS+=(-i "$PWD/.deploy_ssh/id_ed25519" -o IdentitiesOnly=yes
             -o UserKnownHostsFile="$PWD/.deploy_ssh/known_hosts")
fi
SSH_FILTER='post-quantum|store now|openssh.com|^\*\*'

# 远程命令封装：保留真实退出码（过滤 SSH 带宽提示的噪音输出）
# 注意：用 sed 而非 grep -Ev —— OpenSSH 10.3+ 的 post-quantum 警告可能占满全部输出，
# grep 过滤后无匹配行会返回 1，在 set -euo pipefail 下误杀成功流程
remote() { ssh "${SSH_OPTS[@]}" "$SERVER" "$@" 2>&1 | sed -E "/$SSH_FILTER/d"; }
# 上传封装
put() { scp "${SSH_OPTS[@]}" "$1" "$SERVER:$2" 2>&1 | sed -E "/$SSH_FILTER/d"; }

echo "==> [1/5] 连通性检查：$SERVER:$DIR（$URL）"
remote "echo SSH_OK" >/dev/null
echo "    SSH 通道正常"

echo "==> [2/5] 本地交叉编译 Linux 二进制（linux/amd64, CGO=0）"
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o bin/seamcap ./cmd/server
echo "    bin/seamcap $(du -h bin/seamcap | cut -f1)"

echo "==> [3/5] 上传二进制 / 迁移 / 前端静态与后台 SPA"
remote "mkdir -p $DIR/bin $DIR/migrations $DIR/web" >/dev/null
put bin/seamcap "$DIR/bin/seamcap"
# 迁移全量同步（tar 流式，新增迁移文件自动带上，不再逐个枚举）
tar -C migrations -czf - . | ssh "${SSH_OPTS[@]}" "$SERVER" \
  "mkdir -p $DIR/migrations && tar -C $DIR/migrations -xzf -" 2>&1 | sed -E "/$SSH_FILTER/d" || {
  echo "❌ migrations 同步失败"; exit 1; }
echo "    迁移已同步：$(ls migrations/*.sql | wc -l) 个"
# web/ 整体同步（含 admin SPA 构建产物）；tar 流式传输
tar -C web --exclude='admin-src' -czf - . | ssh "${SSH_OPTS[@]}" "$SERVER" \
  "rm -rf $DIR/web && mkdir -p $DIR/web && tar -C $DIR/web -xzf -" 2>&1 | sed -E "/$SSH_FILTER/d" || {
  echo "❌ web 同步失败"; exit 1; }
echo "    上传完成"

echo "==> [4/5] 服务器重建镜像并重启容器"
remote "cd $DIR && docker compose build 2>&1 | tail -2 && docker compose up -d 2>&1 | tail -2"
remote "docker ps --format '{{.Names}} {{.Status}}' | grep '^seamcap '"

echo "==> [5/5] 健康检查（等待容器就绪）"
sleep 4
ok=0
for i in 1 2 3 4 5; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$URL/api/v1/site" || true)
  if [ "$code" = "200" ]; then ok=1; break; fi
  echo "    第 $i 次探测：HTTP $code，2 秒后重试"
  sleep 2
done

if [ "$ok" = "1" ]; then
  echo "✅ 部署成功：$URL"
else
  echo "❌ 健康检查未通过，请登录服务器执行 docker logs seamcap --tail 50 排查"
  exit 1
fi
