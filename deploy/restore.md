# SeamCap 恢复步骤（每季度演练一次）

## 前提

- 新服务器已安装 Go 编译的二进制（或直接拷贝 `bin/seamcap`）、Caddy/Nginx、sqlite3 CLI。
- 已备份：`data/backups/db-<TS>.db` 与 `data/backups/uploads-<TS>.tar.gz`。

## 步骤

1. **停止服务**（避免恢复过程中写入）：
   ```bash
   sudo systemctl stop seamcap
   ```

2. **恢复数据库**：
   ```bash
   sudo -u seamcap mkdir -p /opt/seamcap/data
   sudo -u seamcap cp data/backups/db-<TS>.db /opt/seamcap/data/seamcap.db
   # 删除旧的 WAL/SHM 文件（属于旧库）
   sudo -u seamcap rm -f /opt/seamcap/data/seamcap.db-wal /opt/seamcap/data/seamcap.db-shm
   ```

3. **恢复 uploads**：
   ```bash
   sudo -u seamcap mkdir -p /opt/seamcap
   sudo -u seamcap tar -xzf data/backups/uploads-<TS>.tar.gz -C /opt/seamcap
   ```

4. **校验 .env 与 secret.key**：`data/secret.key` 未随备份走时无需恢复（CSRF token 会随会话重建自动失效），
   但 `.env` 中的 SMTP 凭据必须就位。

5. **启动并验证**：
   ```bash
   sudo systemctl start seamcap
   curl -s http://127.0.0.1:8080/api/v1/health   # 期望 {"status":"ok","db":"ok",...}
   ```

6. **验收清单**：后台登录、产品列表/图片显示、询价提交测试、sitemap 可访问。
