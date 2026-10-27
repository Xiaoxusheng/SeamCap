package service

import (
	"fmt"
	"strings"
	"testing"
)

// 占位哈希的参数必须与 argon* 常量一致，否则"用户不存在"和"密码错误"两条路径
// 的耗时会不同，时序侧信道防御就失效了。
func TestDummyHashParamsMatchArgonConstants(t *testing.T) {
	parts := strings.Split(dummyPasswordHash, "$")
	if len(parts) != 6 || parts[1] != "argon2id" {
		t.Fatalf("malformed dummy hash: %q", dummyPasswordHash)
	}
	var m, tt uint32
	var p uint8
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &m, &tt, &p); err != nil {
		t.Fatalf("parse params: %v", err)
	}
	if m != argonMemory || tt != argonTime || p != argonThreads {
		t.Fatalf("dummy hash params m=%d,t=%d,p=%d != constants m=%d,t=%d,p=%d",
			m, tt, p, argonMemory, argonTime, argonThreads)
	}
	if !VerifyPassword(dummyPasswordHash, "seamcap-timing-decoy") {
		t.Fatal("decoy password should verify against dummy hash")
	}
	if VerifyPassword(dummyPasswordHash, "not-the-decoy") {
		t.Fatal("unexpected password verified against dummy hash")
	}
}

func TestArgon2Concurrency(t *testing.T) {
	cases := []struct {
		name  string
		limit int64
		want  int
	}{
		{"unknown defaults to 2", 0, 2},
		{"512MiB still 2", 512 << 20, 2},
		{"1GiB stays 2", 990 << 20, 2},
		{"2GiB allows 4", 2 << 30, 4},
		{"8GiB capped at 4", 8 << 30, 4},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := argon2Concurrency(c.limit); got != c.want {
				t.Fatalf("argon2Concurrency(%d) = %d, want %d", c.limit, got, c.want)
			}
		})
	}
}
