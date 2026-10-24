#!/usr/bin/env bash
# SeamCap 备份：SQLite 在线备份（VACUUM INTO，不停机）+ uploads 打包
# cron 建议：每日 03:00；保留最近 30 份；每季度执行一次恢复演练
set -euo pipefail

TS=$(date +%Y%m%d-%H%M%S)
BASE=/opt/seamcap
BACKUP_DIR=$BASE/data/backups
mkdir -p "$BACKUP_DIR"

sqlite3 "$BASE/data/seamcap.db" "VACUUM INTO '$BACKUP_DIR/db-$TS.db'"
tar -czf "$BACKUP_DIR/uploads-$TS.tar.gz" -C "$BASE" uploads

# 保留最近 30 份
ls -1t "$BACKUP_DIR"/db-*.db      | tail -n +31 | xargs -r rm -f
ls -1t "$BACKUP_DIR"/uploads-*.tar.gz | tail -n +31 | xargs -r rm -f

echo "backup done: db-$TS.db, uploads-$TS.tar.gz"
# 建议再同步到异地/对象存储
