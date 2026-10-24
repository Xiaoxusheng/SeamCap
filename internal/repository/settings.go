package repository

// SettingsRepo site_settings KV。
type SettingsRepo struct{ db *DB }

func NewSettingsRepo(db *DB) *SettingsRepo { return &SettingsRepo{db} }

// GetAll 全部 KV。
func (r *SettingsRepo) GetAll() (map[string]string, error) {
	rows, err := r.db.Query(`SELECT key, value FROM site_settings`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]string{}
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, err
		}
		out[k] = v
	}
	return out, rows.Err()
}

// SetMany 批量 upsert。
func (r *SettingsRepo) SetMany(kv map[string]string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	now := Now()
	for k, v := range kv {
		if _, err := tx.Exec(`INSERT INTO site_settings(key, value, updated_at) VALUES(?,?,?)
			ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`, k, v, now); err != nil {
			return err
		}
	}
	return tx.Commit()
}
