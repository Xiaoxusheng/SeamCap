package repository

import (
	"database/sql"
	"errors"

	"seamcap/internal/model"
)

// AdminRepo admin_users + sessions。
type AdminRepo struct{ db *DB }

func NewAdminRepo(db *DB) *AdminRepo { return &AdminRepo{db} }

func (r *AdminRepo) CountAdmins() (int, error) {
	var n int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM admin_users`).Scan(&n)
	return n, err
}

func (r *AdminRepo) CreateAdmin(username, passwordHash string) (int64, error) {
	now := Now()
	res, err := r.db.Exec(`INSERT INTO admin_users(username, password_hash, created_at, updated_at) VALUES(?,?,?,?)`,
		username, passwordHash, now, now)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (r *AdminRepo) GetAdminByUsername(username string) (*model.AdminUser, error) {
	row := r.db.QueryRow(`SELECT id, username, password_hash, created_at, updated_at FROM admin_users WHERE username = ?`, username)
	return scanAdmin(row)
}

func (r *AdminRepo) GetAdminByID(id int64) (*model.AdminUser, error) {
	row := r.db.QueryRow(`SELECT id, username, password_hash, created_at, updated_at FROM admin_users WHERE id = ?`, id)
	return scanAdmin(row)
}

func (r *AdminRepo) UpdatePassword(id int64, passwordHash string) error {
	_, err := r.db.Exec(`UPDATE admin_users SET password_hash = ?, updated_at = ? WHERE id = ?`,
		passwordHash, Now(), id)
	return err
}

func scanAdmin(row *sql.Row) (*model.AdminUser, error) {
	var a model.AdminUser
	var hash string
	err := row.Scan(&a.ID, &a.Username, &hash, &a.CreatedAt, &a.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	a.PasswordHash = hash
	return &a, nil
}

// ---- 会话 ----

func (r *AdminRepo) CreateSession(s *model.Session) (int64, error) {
	res, err := r.db.Exec(`INSERT INTO sessions(token_hash, admin_id, ip, user_agent, expires_at, created_at) VALUES(?,?,?,?,?,?)`,
		s.TokenHash, s.AdminID, s.IP, s.UserAgent, s.ExpiresAt, Now())
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (r *AdminRepo) GetSession(tokenHash string) (*model.Session, error) {
	var s model.Session
	err := r.db.QueryRow(`SELECT id, token_hash, admin_id, COALESCE(ip,''), COALESCE(user_agent,''), expires_at, created_at
		FROM sessions WHERE token_hash = ?`, tokenHash).
		Scan(&s.ID, &s.TokenHash, &s.AdminID, &s.IP, &s.UserAgent, &s.ExpiresAt, &s.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// ExtendSession 滑动续期。
func (r *AdminRepo) ExtendSession(id int64, expiresAt string) error {
	_, err := r.db.Exec(`UPDATE sessions SET expires_at = ? WHERE id = ?`, expiresAt, id)
	return err
}

func (r *AdminRepo) DeleteSession(tokenHash string) error {
	_, err := r.db.Exec(`DELETE FROM sessions WHERE token_hash = ?`, tokenHash)
	return err
}

// DeleteExpiredSessions 清理过期会话（登录时顺带执行）。
func (r *AdminRepo) DeleteExpiredSessions() (int64, error) {
	res, err := r.db.Exec(`DELETE FROM sessions WHERE expires_at <= ?`, Now())
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// DeleteOtherSessions 删除某管理员除 keepTokenHash 外的全部会话（改密后）。
func (r *AdminRepo) DeleteOtherSessions(adminID int64, keepTokenHash string) error {
	_, err := r.db.Exec(`DELETE FROM sessions WHERE admin_id = ? AND token_hash <> ?`, adminID, keepTokenHash)
	return err
}
