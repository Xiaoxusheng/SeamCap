#!/usr/bin/env bash
# ============================================================================
# SeamCap 服务器初始化（Ubuntu 22.04 / 24.04，全新机器）
#
# 在新买的服务器上以 root 执行一次：
#   bash server-init.sh
#
# 做的事：时区 → 2GB swap → 防火墙 → Docker。不碰任何项目文件。
# 安全前提：本脚本会开启 ufw，但**放行 22 端口在开启之前**，不会把你锁在门外。
#           「禁用密码登录」需要你已有 SSH 密钥，脚本会先检查，没有就跳过并提示。
# ============================================================================
set -euo pipefail

[ "$(id -u)" = "0" ] || { echo "请用 root 执行：sudo bash $0"; exit 1; }

echo "==> [1/5] 系统更新与基础工具"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl ca-certificates gnupg ufw fail2ban >/dev/null
echo "    完成"

echo "==> [2/5] 时区设为 UTC（日志与数据库时间戳统一，规避夏令时）"
timedatectl set-timezone UTC
echo "    当前时间：$(date '+%Y-%m-%d %H:%M:%S %Z')"

echo "==> [3/5] 配置 2GB swap（低配机型构建/备份时的保命内存）"
if swapon --show | grep -q '/swapfile'; then
  echo "    swap 已存在，跳过"
else
  fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  # 低内存机器上让内核更愿意换出，避免 OOM
  sysctl -qw vm.swappiness=10
  grep -q '^vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf
  echo "    已启用 2GB swap（$(free -h | awk '/Swap/{print $2}')）"
fi

echo "==> [4/5] 防火墙：仅放行 22 / 80 / 443"
ufw allow 22/tcp   >/dev/null
ufw allow 80/tcp   >/dev/null
ufw allow 443/tcp  >/dev/null
ufw --force enable >/dev/null
echo "    ufw 已启用"
echo "    提示：接入 Cloudflare 后，把 80/443 收紧为仅 CF 网段回源，见 deploy/CLOUDFLARE.md"

echo "        SSH 加固：检查密钥登录"
if [ -s /root/.ssh/authorized_keys ] || [ -n "$(ls -A /home/*/.ssh/authorized_keys 2>/dev/null)" ]; then
  sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
  sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
  systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || true
  echo "    已禁用密码登录（请确认密钥可登录后再断开当前会话）"
else
  echo "    ⚠ 未检测到 SSH 公钥，跳过禁用密码登录。"
  echo "      配置密钥后手动执行：sed -i 's/^#\\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config && systemctl reload ssh"
fi

echo "==> [5/5] 安装 Docker Engine + compose 插件"
if command -v docker >/dev/null 2>&1; then
  echo "    Docker 已安装：$(docker --version)"
else
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
  echo "    $(docker --version)"
fi
docker compose version >/dev/null 2>&1 || apt-get install -y -qq docker-compose-plugin >/dev/null
echo "    $(docker compose version)"

echo ""
echo "======================================== 初始化完成 ========================================"
echo " 内存：$(free -h | awk '/Mem/{print $2}')   磁盘可用：$(df -h / | awk 'NR==2{print $4}')   时区：$(timedatectl show -p Timezone --value)"
echo ""
echo "下一步："
echo "  1) 本地执行 bash deploy/deploy.sh（先把 SEAMCAP_SERVER 指到本机）"
echo "  2) 按 deploy/DOCKER.md 第 3 步配置服务器 .env（DOMAIN / BASE_URL / SMTP）"
echo "  3) 按 deploy/CLOUDFLARE.md 接 DNS 与证书"
echo "==========================================================================================="
