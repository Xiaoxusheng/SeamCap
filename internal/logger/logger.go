// Package logger 提供结构化 slog 日志（JSON 输出到 stdout）。
// 约束：日志禁止出现密码、会话令牌、SMTP 凭据。
package logger

import (
	"log/slog"
	"os"
	"strings"
)

// New 创建 JSON 格式的 slog.Logger。
func New(level string) *slog.Logger {
	var lv slog.Level
	switch strings.ToLower(level) {
	case "debug":
		lv = slog.LevelDebug
	case "warn", "warning":
		lv = slog.LevelWarn
	case "error":
		lv = slog.LevelError
	default:
		lv = slog.LevelInfo
	}
	h := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: lv})
	return slog.New(h)
}
