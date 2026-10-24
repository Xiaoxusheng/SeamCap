// Package repository 数据访问层：全部 SQL 集中于此（未来迁 PostgreSQL 只改本层）。
package repository

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	_ "modernc.org/sqlite" // 纯 Go SQLite 驱动（无 CGO）
)

// DB 包装 *sql.DB。
type DB struct {
	*sql.DB
}

// Now 返回 UTC RFC3339 文本（秒精度，定长，可安全做字典序比较）。
func Now() string { return time.Now().UTC().Format(time.RFC3339) }

// Open 打开 SQLite 连接并执行未应用的迁移。
func Open(dbPath, migrationsDir string) (*DB, error) {
	if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}
	dsn := fmt.Sprintf("file:%s?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(1)", dbPath)
	sqldb, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	// WAL 允许"单写多读"；写事务短小，busy_timeout 兜底。
	sqldb.SetMaxOpenConns(4)
	sqldb.SetMaxIdleConns(4)
	sqldb.SetConnMaxLifetime(0)

	db := &DB{sqldb}
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("ping sqlite: %w", err)
	}
	if err := db.migrate(migrationsDir); err != nil {
		return nil, fmt.Errorf("migrate: %w", err)
	}
	return db, nil
}

// migrate 按文件名顺序执行未应用的迁移；已应用的记录于 schema_migrations，不覆盖已有数据。
func (d *DB) migrate(dir string) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil // 无迁移目录视为无需迁移
		}
		return err
	}
	var files []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)

	applied := map[string]bool{}
	rows, err := d.Query(`SELECT version FROM schema_migrations`)
	if err == nil {
		for rows.Next() {
			var v string
			if err := rows.Scan(&v); err != nil {
				rows.Close()
				return err
			}
			applied[v] = true
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return err
		}
	} else if !isNoTableErr(err) {
		return err
	}

	for _, name := range files {
		if applied[name] {
			continue
		}
		content, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil {
			return fmt.Errorf("read migration %s: %w", name, err)
		}
		if err := d.applyMigration(name, string(content)); err != nil {
			return fmt.Errorf("apply migration %s: %w", name, err)
		}
	}
	return nil
}

func isNoTableErr(err error) bool {
	return err != nil && strings.Contains(err.Error(), "no such table")
}

// applyMigration 在事务中执行单个迁移脚本（含多语句）。
func (d *DB) applyMigration(version, content string) error {
	tx, err := d.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(content); err != nil {
		return err
	}
	if _, err := tx.Exec(`INSERT INTO schema_migrations(version, applied_at) VALUES(?, ?)`,
		version, Now()); err != nil {
		return err
	}
	return tx.Commit()
}

// ---- 可空扫描辅助 ----

func ns(v sql.NullString) *string {
	if v.Valid {
		return &v.String
	}
	return nil
}

func ni(v sql.NullInt64) *int64 {
	if v.Valid {
		return &v.Int64
	}
	return nil
}

func nint(v sql.NullInt64) *int {
	if v.Valid {
		i := int(v.Int64)
		return &i
	}
	return nil
}

func str(ns *string) string {
	if ns == nil {
		return ""
	}
	return *ns
}

// ---- 通用分页 ----

func clampPage(page, perPage int, defPer int) (int, int) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = defPer
	}
	return page, perPage
}
