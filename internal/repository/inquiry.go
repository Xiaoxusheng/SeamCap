package repository

import (
	"database/sql"
	"errors"
	"time"

	"seamcap/internal/model"
)

// InquiryRepo inquiries + inquiry_events。
type InquiryRepo struct{ db *DB }

func NewInquiryRepo(db *DB) *InquiryRepo { return &InquiryRepo{db} }

const inqCols = `id, name, COALESCE(company,''), email, COALESCE(whatsapp_phone,''), product_id,
	COALESCE(product_name_snapshot,''), COALESCE(product_sku_snapshot,''),
	COALESCE(source_page,''), COALESCE(estimated_qty,''), COALESCE(customization,''), message,
	status, COALESCE(internal_note,''), handled_by, handled_at,
	COALESCE(email_notify_status,'pending'), COALESCE(ip,''), COALESCE(user_agent,''), created_at, updated_at`

func scanInquiry(row interface{ Scan(...any) error }) (*model.Inquiry, error) {
	var q model.Inquiry
	var productID, handledBy sql.NullInt64
	var handledAt sql.NullString
	err := row.Scan(&q.ID, &q.Name, &q.Company, &q.Email, &q.WhatsAppPhone, &productID,
		&q.ProductNameSnapshot, &q.ProductSKUSnapshot,
		&q.SourcePage, &q.EstimatedQty, &q.Customization, &q.Message,
		&q.Status, &q.InternalNote, &handledBy, &handledAt,
		&q.EmailNotifyStatus, &q.IP, &q.UserAgent, &q.CreatedAt, &q.UpdatedAt)
	if err != nil {
		return nil, err
	}
	q.ProductID = ni(productID)
	q.HandledBy = ni(handledBy)
	q.HandledAt = ns(handledAt)
	return &q, nil
}

const inqEventCols = `id, inquiry_id, event_type, COALESCE(from_status,''), COALESCE(to_status,''), admin_id, COALESCE(detail,''), created_at`

func scanInqEvent(row interface{ Scan(...any) error }) (*model.InquiryEvent, error) {
	var e model.InquiryEvent
	var adminID sql.NullInt64
	err := row.Scan(&e.ID, &e.InquiryID, &e.EventType, &e.FromStatus, &e.ToStatus, &adminID, &e.Detail, &e.CreatedAt)
	if err != nil {
		return nil, err
	}
	e.AdminID = ni(adminID)
	return &e, nil
}

// CreateWithEvent 事务写入询价 + created 事件。
func (r *InquiryRepo) CreateWithEvent(q *model.Inquiry) (int64, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	now := Now()
	res, err := tx.Exec(`INSERT INTO inquiries(name, company, email, whatsapp_phone, product_id,
		product_name_snapshot, product_sku_snapshot, source_page, estimated_qty, customization, message,
		status, ip, user_agent, email_notify_status, created_at, updated_at)
		VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		q.Name, q.Company, q.Email, q.WhatsAppPhone, q.ProductID,
		q.ProductNameSnapshot, q.ProductSKUSnapshot, q.SourcePage, q.EstimatedQty, q.Customization, q.Message,
		q.Status, q.IP, q.UserAgent, "pending", now, now)
	if err != nil {
		return 0, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return 0, err
	}
	if _, err := tx.Exec(`INSERT INTO inquiry_events(inquiry_id, event_type, from_status, to_status, detail, created_at)
		VALUES(?,?,?,?,?,?)`, id, "created", "", q.Status, "Inquiry submitted", now); err != nil {
		return 0, err
	}
	q.ID = id
	q.CreatedAt = now
	q.UpdatedAt = now
	return id, tx.Commit()
}

// ListFilters 管理列表筛选。
type ListFilters struct {
	Q      string
	Status string
	From   string // created_at >= From（RFC3339 或日期）
	To     string
	Page   int
	PerPage int
}

// List 管理列表（搜索/筛选/分页），按创建时间倒序。
func (r *InquiryRepo) List(f ListFilters) ([]model.Inquiry, int64, error) {
	f.Page, f.PerPage = clampPage(f.Page, f.PerPage, 20)
	where := "1=1"
	args := []any{}
	if f.Q != "" {
		pat := "%" + f.Q + "%"
		where += ` AND (name LIKE ? OR COALESCE(company,'') LIKE ? OR email LIKE ? OR COALESCE(product_name_snapshot,'') LIKE ? OR COALESCE(product_sku_snapshot,'') LIKE ?)`
		args = append(args, pat, pat, pat, pat, pat)
	}
	if f.Status != "" {
		where += ` AND status = ?`
		args = append(args, f.Status)
	}
	if f.From != "" {
		where += ` AND created_at >= ?`
		args = append(args, f.From)
	}
	if f.To != "" {
		where += ` AND created_at <= ?`
		args = append(args, f.To)
	}
	var total int64
	if err := r.db.QueryRow(`SELECT COUNT(*) FROM inquiries WHERE `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	query := `SELECT ` + inqCols + ` FROM inquiries WHERE ` + where + ` ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`
	args = append(args, f.PerPage, (f.Page-1)*f.PerPage)
	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var out []model.Inquiry
	for rows.Next() {
		q, err := scanInquiry(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, *q)
	}
	return out, total, rows.Err()
}

// ListAllForExport 导出用（同样筛选，无分页上限）。
func (r *InquiryRepo) ListAllForExport(f ListFilters) ([]model.Inquiry, error) {
	f.Page, f.PerPage = 1, 1<<30
	rows, _, err := r.listNoLimit(f)
	return rows, err
}

func (r *InquiryRepo) listNoLimit(f ListFilters) ([]model.Inquiry, int64, error) {
	where := "1=1"
	args := []any{}
	if f.Q != "" {
		pat := "%" + f.Q + "%"
		where += ` AND (name LIKE ? OR COALESCE(company,'') LIKE ? OR email LIKE ? OR COALESCE(product_name_snapshot,'') LIKE ? OR COALESCE(product_sku_snapshot,'') LIKE ?)`
		args = append(args, pat, pat, pat, pat, pat)
	}
	if f.Status != "" {
		where += ` AND status = ?`
		args = append(args, f.Status)
	}
	if f.From != "" {
		where += ` AND created_at >= ?`
		args = append(args, f.From)
	}
	if f.To != "" {
		where += ` AND created_at <= ?`
		args = append(args, f.To)
	}
	var total int64
	if err := r.db.QueryRow(`SELECT COUNT(*) FROM inquiries WHERE `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := r.db.Query(`SELECT `+inqCols+` FROM inquiries WHERE `+where+` ORDER BY created_at DESC, id DESC`, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var out []model.Inquiry
	for rows.Next() {
		q, err := scanInquiry(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, *q)
	}
	return out, total, rows.Err()
}

func (r *InquiryRepo) GetByID(id int64) (*model.Inquiry, error) {
	row := r.db.QueryRow(`SELECT `+inqCols+` FROM inquiries WHERE id = ?`, id)
	q, err := scanInquiry(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return q, err
}

// Events 询价事件历史（正序）。
func (r *InquiryRepo) Events(inquiryID int64) ([]model.InquiryEvent, error) {
	rows, err := r.db.Query(`SELECT `+inqEventCols+` FROM inquiry_events WHERE inquiry_id = ? ORDER BY id`, inquiryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []model.InquiryEvent
	for rows.Next() {
		e, err := scanInqEvent(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *e)
	}
	return out, rows.Err()
}

// Update 状态/备注变更并写事件（事务）。oldStatus 为变更前状态。
func (r *InquiryRepo) Update(q *model.Inquiry, oldStatus string, adminID *int64, statusChanged, noteChanged bool) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	now := Now()
	if _, err := tx.Exec(`UPDATE inquiries SET status=?, internal_note=?, handled_by=?, handled_at=?, updated_at=? WHERE id=?`,
		q.Status, q.InternalNote, q.HandledBy, q.HandledAt, now, q.ID); err != nil {
		return err
	}
	if statusChanged {
		if _, err := tx.Exec(`INSERT INTO inquiry_events(inquiry_id, event_type, from_status, to_status, admin_id, detail, created_at)
			VALUES(?,?,?,?,?,?,?)`, q.ID, "status_changed", oldStatus, q.Status, adminID, "", now); err != nil {
			return err
		}
	}
	if noteChanged {
		if _, err := tx.Exec(`INSERT INTO inquiry_events(inquiry_id, event_type, admin_id, detail, created_at)
			VALUES(?,?,?,?,?)`, q.ID, "note", adminID, q.InternalNote, now); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// SetEmailNotifyStatus 更新邮件通知状态并写事件。
func (r *InquiryRepo) SetEmailNotifyStatus(id int64, status, detail string) error {
	now := Now()
	if _, err := r.db.Exec(`UPDATE inquiries SET email_notify_status=?, updated_at=? WHERE id=?`, status, now, id); err != nil {
		return err
	}
	_, err := r.db.Exec(`INSERT INTO inquiry_events(inquiry_id, event_type, detail, created_at) VALUES(?,?,?,?)`,
		id, "notify", detail, now)
	return err
}

// Delete 删除询价（事件级联）。
func (r *InquiryRepo) Delete(id int64) error {
	_, err := r.db.Exec(`DELETE FROM inquiries WHERE id = ?`, id)
	return err
}

// CountNew 新询价数。
func (r *InquiryRepo) CountNew() (int64, error) {
	var n int64
	err := r.db.QueryRow(`SELECT COUNT(*) FROM inquiries WHERE status='new'`).Scan(&n)
	return n, err
}

// Recent 最近 N 条询价。
func (r *InquiryRepo) Recent(limit int) ([]model.Inquiry, error) {
	rows, err := r.db.Query(`SELECT `+inqCols+` FROM inquiries ORDER BY created_at DESC, id DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []model.Inquiry
	for rows.Next() {
		q, err := scanInquiry(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *q)
	}
	return out, rows.Err()
}

// CountByIPLastIPHour 同 IP 一小时内的提交数（限流）。
func (r *InquiryRepo) CountByIPLastHour(ip string) (int64, error) {
	oneHourAgo := timeHourAgo()
	var n int64
	err := r.db.QueryRow(`SELECT COUNT(*) FROM inquiries WHERE ip = ? AND created_at >= ?`, ip, oneHourAgo).Scan(&n)
	return n, err
}

// LastCreatedAtForIP 同 IP 最近一次提交时间（最小提交间隔检查）。
func (r *InquiryRepo) LastCreatedAtForIP(ip string) (*string, error) {
	var s string
	err := r.db.QueryRow(`SELECT created_at FROM inquiries WHERE ip = ? ORDER BY created_at DESC, id DESC LIMIT 1`, ip).Scan(&s)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// timeHourAgo 一小时前的 RFC3339 文本。
func timeHourAgo() string {
	return time.Now().UTC().Add(-time.Hour).Format(time.RFC3339)
}
