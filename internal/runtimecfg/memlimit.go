// Package runtimecfg 依据运行环境设置 Go 运行时的内存上限。
//
// 生产是一台 1C1G 的小机器：Go 默认 GOGC=100，堆会随存活对象翻倍增长；
// 叠加 Argon2（单次 64MiB）、图片解码等临时大分配时容易形成尖峰。
// debug.SetMemoryLimit 给出软上限，让 GC 在接近上限时提前回收，
// 把"内存涨到被 OOM killer 杀掉"变成"多点几次 GC"。
package runtimecfg

import (
	"os"
	"runtime/debug"
	"strconv"
	"strings"
	"sync"
)

const (
	// softLimitPercent 软上限占可用内存的百分比：余下 30% 留给页缓存、
	// 二进制/栈/线程栈，以及 Go 堆统计不到的运行时分配。
	softLimitPercent = 70
	// minSoftLimit 低于该值不设置，避免在极小容器或测试环境里把 GC 逼成抖动。
	minSoftLimit = 128 << 20
	// unlimited cgroup 用超大数表示"不限制"，超过该值视为未设置。
	unlimited = int64(1) << 50
)

var (
	limitOnce  sync.Once
	limitBytes int64
)

// LimitBytes 返回检测到的可用内存字节数（0 = 未知或已显式关闭）。
// 优先级：MEMORY_LIMIT_MB 环境变量 > cgroup 限额 > /proc/meminfo 物理内存。
// 结果进程内只计算一次，供运行时与各服务的并发度决策共用。
func LimitBytes() int64 {
	limitOnce.Do(func() { limitBytes = detectLimit() })
	return limitBytes
}

// Apply 按检测结果设置 Go 软内存上限，返回生效值（0 = 未设置）。
// 应在 main 中尽早调用，并记录返回值便于线上核对。
func Apply() int64 {
	limit := LimitBytes()
	if limit <= 0 {
		return 0
	}
	soft := limit * softLimitPercent / 100
	if soft < minSoftLimit {
		return 0
	}
	debug.SetMemoryLimit(soft)
	return soft
}

func detectLimit() int64 {
	if v, ok := envLimit(); ok {
		return v
	}
	if v := cgroupLimit(); v > 0 {
		return v
	}
	return physicalMemory()
}

// envLimit 解析 MEMORY_LIMIT_MB：
//   - 未设置        → (0, false)，走自动检测
//   - 正整数        → 该值作为上限
//   - 0/负数/非法值 → (0, true)，显式关闭自动检测（本地开发想跑满内存时用）
func envLimit() (int64, bool) {
	raw := strings.TrimSpace(os.Getenv("MEMORY_LIMIT_MB"))
	if raw == "" {
		return 0, false
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return 0, true
	}
	return int64(n) << 20, true
}

// cgroupLimit 读取 cgroup v1/v2 的内存限额，两者都存在时取更严格者。
func cgroupLimit() int64 {
	var best int64
	for _, p := range []string{
		"/sys/fs/cgroup/memory.max",                   // cgroup v2
		"/sys/fs/cgroup/memory/memory.limit_in_bytes", // cgroup v1
	} {
		raw, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		s := strings.TrimSpace(string(raw))
		if s == "" || s == "max" {
			continue
		}
		n, err := strconv.ParseInt(s, 10, 64)
		if err != nil || n <= 0 || n >= unlimited {
			continue
		}
		if best == 0 || n < best {
			best = n
		}
	}
	return best
}

// physicalMemory 从 /proc/meminfo 读物理内存（非 Linux 平台返回 0 = 不设上限）。
func physicalMemory() int64 {
	raw, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return 0
	}
	for _, line := range strings.Split(string(raw), "\n") {
		if !strings.HasPrefix(line, "MemTotal:") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 2 {
			return 0
		}
		kb, err := strconv.ParseInt(fields[1], 10, 64)
		if err != nil || kb <= 0 {
			return 0
		}
		return kb << 10
	}
	return 0
}
