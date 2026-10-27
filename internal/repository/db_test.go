package repository

import (
	"path/filepath"
	"testing"
)

// Open 必须把内存相关 pragma 真正下发到连接上（否则改 DSN 只是自我安慰）。
func TestOpenAppliesConnectionPragmas(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "test.db"), "../../migrations")
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer db.Close()

	var cacheSize int
	if err := db.QueryRow(`PRAGMA cache_size`).Scan(&cacheSize); err != nil {
		t.Fatalf("read cache_size: %v", err)
	}
	if cacheSize != -1024 {
		t.Fatalf("cache_size = %d, want -1024 (1MiB per connection)", cacheSize)
	}

	var journal string
	if err := db.QueryRow(`PRAGMA journal_mode`).Scan(&journal); err != nil {
		t.Fatalf("read journal_mode: %v", err)
	}
	if journal != "wal" {
		t.Fatalf("journal_mode = %q, want wal", journal)
	}
}
