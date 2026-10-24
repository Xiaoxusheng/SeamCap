package repository

// AuditRepo audit_logs。
type AuditRepo struct{ db *DB }

func NewAuditRepo(db *DB) *AuditRepo { return &AuditRepo{db} }

// Insert 写入审计日志。
func (r *AuditRepo) Insert(adminID *int64, action, entityType, entityID, detail, ip string) error {
	_, err := r.db.Exec(`INSERT INTO audit_logs(admin_id, action, entity_type, entity_id, detail, ip, created_at)
		VALUES(?,?,?,?,?,?,?)`,
		adminID, action, entityType, entityID, detail, ip, Now())
	return err
}

// List 最近日志。
func (r *AuditRepo) List(limit int) ([]AuditRow, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := r.db.Query(`SELECT a.id, a.admin_id, a.action, COALESCE(a.entity_type,''), COALESCE(a.entity_id,''),
		COALESCE(a.detail,''), COALESCE(a.ip,''), a.created_at, COALESCE(u.username,'')
		FROM audit_logs a LEFT JOIN admin_users u ON u.id = a.admin_id
		ORDER BY a.id DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []AuditRow
	for rows.Next() {
		var r AuditRow
		var adminID *int64
		if err := rows.Scan(&r.ID, &adminID, &r.Action, &r.EntityType, &r.EntityID, &r.Detail, &r.IP, &r.CreatedAt, &r.AdminUsername); err != nil {
			return nil, err
		}
		r.AdminID = adminID
		out = append(out, r)
	}
	return out, rows.Err()
}

// AuditRow 审计日志行（带操作人用户名）。
type AuditRow struct {
	ID            int64   `json:"id"`
	AdminID       *int64  `json:"admin_id"`
	AdminUsername string  `json:"admin_username"`
	Action        string  `json:"action"`
	EntityType    string  `json:"entity_type"`
	EntityID      string  `json:"entity_id"`
	Detail        string  `json:"detail"`
	IP            string  `json:"ip"`
	CreatedAt     string  `json:"created_at"`
}
