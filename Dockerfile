# syntax=docker/dockerfile:1
# SeamCap 生产镜像：三阶段构建（管理后台 SPA → Go 后端 → 运行时）

########## Stage 1: 构建管理后台 SPA（Vite/React）##########
FROM node:22-alpine AS admin-build
WORKDIR /build/web/admin-src
COPY web/admin-src/package.json web/admin-src/package-lock.json ./
RUN npm ci
COPY web/admin-src/ ./
RUN npm run build
# 产物输出到 /build/web/admin（vite outDir: ../admin）

########## Stage 2: 构建 Go 后端（modernc 纯 Go SQLite，无需 CGO）##########
FROM golang:1.27-alpine AS go-build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd/ ./cmd/
COPY internal/ ./internal/
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/seamcap ./cmd/server

########## Stage 3: 运行时镜像 ##########
FROM alpine:3.20

# ca-certificates：SMTP SSL / HTTPS 外呼；tzdata：时区；wget：健康检查
RUN apk add --no-cache ca-certificates tzdata wget

RUN addgroup -g 10001 seamcap \
 && adduser -D -u 10001 -G seamcap seamcap

WORKDIR /app

# 二进制 + 迁移 + 前台静态页
COPY --from=go-build /out/seamcap ./seamcap
COPY migrations/ ./migrations/
COPY web/ ./web/
# 管理后台 SPA（镜像内重新构建的产物，覆盖保证版本一致）
COPY --from=admin-build /build/web/admin ./web/admin

# 数据目录（运行时以卷挂载持久化：SQLite + secret.key + 上传文件）
RUN mkdir -p /app/data /app/uploads \
 && chown -R seamcap:seamcap /app
VOLUME ["/app/data", "/app/uploads"]

USER seamcap

ENV APP_ENV=production \
    PORT=8080 \
    DB_PATH=/app/data/seamcap.db \
    UPLOAD_DIR=/app/uploads \
    BACKUP_DIR=/app/data/backups

EXPOSE 8080

# 探活走 /robots.txt（不查库、开销极小）
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/robots.txt || exit 1

ENTRYPOINT ["/app/seamcap"]
