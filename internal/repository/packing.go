package repository

import (
	"database/sql"
	"errors"

	"seamcap/internal/model"
)

// PackingRepo 打包发货素材库。
type PackingRepo struct {
	db    *DB
	media *MediaRepo
}

func NewPackingRepo(db *DB, media *MediaRepo) *PackingRepo { return &PackingRepo{db, media} }

const packingCols = `p.id, p.category, COALESCE(p.title,''), COALESCE(p.caption,''), p.media_id,
	m.id, m.filename, m.original_name, COALESCE(m.alt_text,''), m.mime_type, m.size_bytes, m.width, m.height, m.sha256, m.created_at,
	p.sort_order, p.status, p.created_at, p.updated_at`

const packingFrom = `FROM packing_items p LEFT JOIN media_assets m ON m.id = p.media_id`

// scanPackingRow 扫描带媒体左连接的素材行（19 列）。
func scanPackingRow(row interface{ Scan(...any) error }) (*model.PackingItem, error) {
	var it model.PackingItem
	var mediaID sql.NullInt64
	var mID sql.NullInt64
	var mFilename, mOrig, mAlt, mMime, mSHA, mCreated sql.NullString
	var mSize, mW, mH sql.NullInt64
	err := row.Scan(&it.ID, &it.Category, &it.Title, &it.Caption, &mediaID,
		&mID, &mFilename, &mOrig, &mAlt, &mMime, &mSize, &mW, &mH, &mSHA, &mCreated,
		&it.SortOrder, &it.Status, &it.CreatedAt, &it.UpdatedAt)
	if err != nil {
		return nil, err
	}
	if mediaID.Valid {
		it.MediaID = mediaID.Int64
	}
	if mFilename.Valid {
		it.Media = &model.Media{
			ID:           mID.Int64,
			Filename:     mFilename.String,
			URL:          mediaURL(mFilename.String),
			OriginalName: mOrig.String,
			AltText:      mAlt.String,
			MimeType:     mMime.String,
			SizeBytes:    mSize.Int64,
			Width:        nint(mW),
			Height:       nint(mH),
			SHA256:       mSHA.String,
			CreatedAt:    mCreated.String,
		}
	}
	return &it, nil
}

func (r *PackingRepo) collect(rows *sql.Rows) ([]model.PackingItem, error) {
	defer rows.Close()
	var out []model.PackingItem
	for rows.Next() {
		it, err := scanPackingRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *it)
	}
	return out, rows.Err()
}

// ListPublic 已发布素材（前台图库）。
func (r *PackingRepo) ListPublic() ([]model.PackingItem, error) {
	rows, err := r.db.Query(`SELECT ` + packingCols + ` ` + packingFrom + ` WHERE p.status='published' ORDER BY p.sort_order, p.id`)
	if err != nil {
		return nil, err
	}
	return r.collect(rows)
}

// ListAdmin 全部素材。
func (r *PackingRepo) ListAdmin() ([]model.PackingItem, error) {
	rows, err := r.db.Query(`SELECT ` + packingCols + ` ` + packingFrom + ` ORDER BY p.sort_order, p.id`)
	if err != nil {
		return nil, err
	}
	return r.collect(rows)
}

func (r *PackingRepo) GetByID(id int64) (*model.PackingItem, error) {
	row := r.db.QueryRow(`SELECT `+packingCols+` `+packingFrom+` WHERE p.id = ?`, id)
	it, err := scanPackingRow(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return it, err
}

func (r *PackingRepo) Create(it *model.PackingItem) (int64, error) {
	now := Now()
	res, err := r.db.Exec(`INSERT INTO packing_items(category, title, caption, media_id, sort_order, status, created_at, updated_at)
		VALUES(?,?,?,?,?,?,?,?)`,
		it.Category, it.Title, it.Caption, it.MediaID, it.SortOrder, it.Status, now, now)
	if err != nil {
		return 0, err
	}
	id, err := res.LastInsertId()
	it.ID = id
	it.CreatedAt = now
	it.UpdatedAt = now
	return id, err
}

func (r *PackingRepo) Update(it *model.PackingItem) error {
	it.UpdatedAt = Now()
	_, err := r.db.Exec(`UPDATE packing_items SET category=?, title=?, caption=?, media_id=?, sort_order=?, status=?, updated_at=? WHERE id=?`,
		it.Category, it.Title, it.Caption, it.MediaID, it.SortOrder, it.Status, it.UpdatedAt, it.ID)
	return err
}

func (r *PackingRepo) Delete(id int64) error {
	_, err := r.db.Exec(`DELETE FROM packing_items WHERE id = ?`, id)
	return err
}

// NextSort 返回下一个可用排序值（批量添加追加到末尾）。
func (r *PackingRepo) NextSort() (int, error) {
	var max sql.NullInt64
	if err := r.db.QueryRow(`SELECT MAX(sort_order) FROM packing_items`).Scan(&max); err != nil {
		return 0, err
	}
	return int(max.Int64) + 1, nil
}

// Count 素材总数（仪表盘/后台列表用）。
func (r *PackingRepo) Count() (int64, error) {
	var n int64
	err := r.db.QueryRow(`SELECT COUNT(*) FROM packing_items`).Scan(&n)
	return n, err
}
