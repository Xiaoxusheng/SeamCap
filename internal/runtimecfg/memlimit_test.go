package runtimecfg

import "testing"

func TestEnvLimit(t *testing.T) {
	cases := []struct {
		name    string
		val     string
		want    int64
		wantSet bool
	}{
		{"unset falls back to detection", "", 0, false},
		{"megabytes", "512", 512 << 20, true},
		{"trimmed", " 256 ", 256 << 20, true},
		{"zero disables detection", "0", 0, true},
		{"negative disables detection", "-1", 0, true},
		{"garbage disables detection", "abc", 0, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Setenv("MEMORY_LIMIT_MB", c.val)
			got, set := envLimit()
			if got != c.want || set != c.wantSet {
				t.Fatalf("envLimit(%q) = (%d, %v), want (%d, %v)", c.val, got, set, c.want, c.wantSet)
			}
		})
	}
}

func TestApplySkipsTinyLimits(t *testing.T) {
	// 显式把上限设成很小的值时应拒绝设置软上限，避免测试/极小容器里 GC 抖动。
	t.Setenv("MEMORY_LIMIT_MB", "64")
	if got := Apply(); got != 0 {
		t.Fatalf("Apply() = %d, want 0 for 64MiB limit", got)
	}
}

func TestDetectLimitSanity(t *testing.T) {
	// 自动检测只能给出"未知"或一个合理正数，不能出现负数/荒谬小值。
	got := detectLimit()
	if got < 0 {
		t.Fatalf("detectLimit() = %d, want >= 0", got)
	}
	if got > 0 && got < 64<<20 {
		t.Fatalf("detectLimit() = %d, suspiciously small", got)
	}
}
