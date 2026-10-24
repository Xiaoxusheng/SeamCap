// Package secret 服务端随机密钥的持久化加载（CSRF 派生等用途）。
package secret

import (
	"crypto/rand"
	"encoding/hex"
	"os"
	"path/filepath"
	"strings"
)

// LoadOrCreateSecret 读取或创建 32 字节随机密钥（hex 文本存储于 path）。
func LoadOrCreateSecret(path string) ([]byte, error) {
	if b, err := os.ReadFile(path); err == nil {
		if dec, derr := hex.DecodeString(strings.TrimSpace(string(b))); derr == nil && len(dec) >= 32 {
			return dec, nil
		}
	}
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return nil, err
	}
	enc := hex.EncodeToString(raw)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	if err := os.WriteFile(path, []byte(enc), 0o600); err != nil {
		return nil, err
	}
	return raw, nil
}
