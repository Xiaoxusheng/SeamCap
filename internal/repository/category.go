package repository

import (
	"database/sql"
	"errors"

	"seamcap/internal/model"
)

// CategoryRepo product_categories。
type CategoryRepo struct {
	db    *DB
	media *MediaRepo
}

func NewCategoryRepo(db *DB, media *MediaRepo) *CategoryRepo { return &CategoryRepo{db, media} }

const catCols = `c.id, c.name, COALESCE(c.name_en,''), c.slug, COALESCE(c.description,''), c.image_id,
	m.id, m.filename, m.original_name, m.alt_text, m.mime_type, m.size_bytes, m.width, m.height, m.sha256, m.created_at,
	c.sort_order, c.status, c.created_at, c.updated_at`

const catFrom = `FROM product_categories c LEFT JOIN media_assets m ON m.id = c.image_id`

// scanCategoryRow 扫描带媒体左连接的分类行（20 列）。
func scanCategoryRow(row interface{ Scan(...any) error }) (*model.Category, error) {
	var c model.Category
	var imgID sql.NullInt64
	var mID sql.NullInt64
	var mFilename, mOrig, mAlt, mMime, mSHA, mCreated sql.NullString
	var mSize sql.NullInt64
	var mW, mH sql.NullInt64
	err := row.Scan(&c.ID, &c.Name, &c.NameEn, &c.Slug, &c.Description, &imgID,
		&mID, &mFilename, &mOrig, &mAlt, &mMime, &mSize, &mW, &mH, &mSHA, &mCreated,
		&c.SortOrder, &c.Status, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, err
	}
	c.ImageID = ni(imgID)
	if mFilename.Valid {
		c.Image = &model.Media{
			ID:       mID.Int64,
			Filename: mFilename.String, URL: mediaURL(mFilename.String),
			OriginalName: mOrig.String, AltText: mAlt.String, MimeType: mMime.String,
			SizeBytes: mSize.Int64, Width: nint(mW), Height: nint(mH),
			SHA256: mSHA.String, CreatedAt: mCreated.String,
		}
	}
	return &c, nil
}

// ListPublic 公开分类：仅 active，按 sort_order。
func (r *CategoryRepo) ListPublic() ([]model.Category, error) {
	rows, err := r.db.Query(`SELECT ` + catCols + ` ` + catFrom + ` WHERE c.status='active' ORDER BY c.sort_order, c.id`)
	if err != nil {
		return nil, err
	}
	return collectCategories(rows)
}

// ListAdmin 全部分类（含 inactive）。
func (r *CategoryRepo) ListAdmin() ([]model.Category, error) {
	rows, err := r.db.Query(`SELECT ` + catCols + ` ` + catFrom + ` ORDER BY c.sort_order, c.id`)
	if err != nil {
		return nil, err
	}
	return collectCategories(rows)
}

func collectCategories(rows *sql.Rows) ([]model.Category, error) {
	defer rows.Close()
	var out []model.Category
	for rows.Next() {
		c, err := scanCategoryRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *c)
	}
	return out, rows.Err()
}

func (r *CategoryRepo) GetByID(id int64) (*model.Category, error) {
	row := r.db.QueryRow(`SELECT `+catCols+` `+catFrom+` WHERE c.id = ?`, id)
	c, err := scanCategoryRow(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return c, err
}

func (r *CategoryRepo) GetBySlug(slug string) (*model.Category, error) {
	row := r.db.QueryRow(`SELECT `+catCols+` `+catFrom+` WHERE c.slug = ?`, slug)
	c, err := scanCategoryRow(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return c, err
}

func (r *CategoryRepo) Create(c *model.Category) (int64, error) {
	now := Now()
	res, err := r.db.Exec(`INSERT INTO product_categories(name, name_en, slug, description, image_id, sort_order, status, created_at, updated_at)
		VALUES(?,?,?,?,?,?,?,?,?)`,
		c.Name, c.NameEn, c.Slug, c.Description, c.ImageID, c.SortOrder, c.Status, now, now)
	if err != nil {
		return 0, err
	}
	id, err := res.LastInsertId()
	c.ID = id
	c.CreatedAt = now
	c.UpdatedAt = now
	return id, err
}

func (r *CategoryRepo) Update(c *model.Category) error {
	c.UpdatedAt = Now()
	_, err := r.db.Exec(`UPDATE product_categories SET name=?, name_en=?, slug=?, description=?, image_id=?, sort_order=?, status=?, updated_at=? WHERE id=?`,
		c.Name, c.NameEn, c.Slug, c.Description, c.ImageID, c.SortOrder, c.Status, c.UpdatedAt, c.ID)
	return err
}

// Archive 停用分类（?mode=archive）。
func (r *CategoryRepo) Archive(id int64) error {
	_, err := r.db.Exec(`UPDATE product_categories SET status='inactive', updated_at=? WHERE id=?`, Now(), id)
	return err
}

// Delete 删除分类（products.category_id 由 FK 置 NULL）。
func (r *CategoryRepo) Delete(id int64) error {
	_, err := r.db.Exec(`DELETE FROM product_categories WHERE id = ?`, id)
	return err
}
