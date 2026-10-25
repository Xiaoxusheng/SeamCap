#!/usr/bin/env bash
set -uo pipefail
cd /d/SeamCap
SERVER="root@xyx.homes"; DIR="/opt/seamcap"
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=12 -o StrictHostKeyChecking=accept-new
          -i "$PWD/.deploy_ssh/id_ed25519" -o IdentitiesOnly=yes
          -o UserKnownHostsFile="$PWD/.deploy_ssh/known_hosts")
for i in 1 2 3 4; do
  if tar -C web -czf - static/img/brand/logo-on-dark.svg static/img/brand/logo-on-light.svg 2>/dev/null | \
     ssh "${SSH_OPTS[@]}" "$SERVER" "tar -C $DIR/web -xzf -" 2>&1 | grep -v "post-quantum\|store now\|openssh.com"; then
    echo "✔ 同步完成"; break
  fi
  echo "✖ 第 $i 次失败"; sleep 4; [ "$i" = "4" ] && exit 1
done
ssh "${SSH_OPTS[@]}" "$SERVER" "cd $DIR && export APP_DOCKERFILE=Dockerfile.runtime && docker compose build 2>&1 | tail -1 && docker compose up -d 2>&1 | tail -1" 2>&1 | grep -v "post-quantum\|store now\|openssh.com"
sleep 5
curl -sk -m 20 -o /dev/null -w "健康检查: %{http_code}\n" "https://xyx.homes:8890/api/v1/site"
