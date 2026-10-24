package repository

import (
	"database/sql"
	"errors"

	"seamcap/internal/model"
)

// CraftRepo craftsmanship。
type CraftRepo struct {
	db    *DB
	media *MediaRepo
}

func NewCraftRepo(db *DB, media *MediaRepo) *CraftRepo { return &CraftRepo{db, media} }

const craftCols = `c.id, c.title, c.slug, COALESCE(c.summary,''), COALESCE(c.body,''), c.cover_image_id,
	m.filename, m.original_name, m.alt_text, m.mime_type, m.size_bytes, m.width, m.height, m.sha256, m.created_at,
	COALESCE(c.video_url,''), c.sort_order, c.status, COALESCE(c.seo_title,''), COALESCE(c.seo_desc,''),
	c.created_at, c.updated_at, c.published_at`

const craftFrom = `FROM craftsmanship c LEFT JOIN media_assets m ON m.id = c.cover_image_id`

// scanCraftRow 扫描带封面左连接的工艺行（23 列）。
func scanCraftRow(row interface{ Scan(...any) error }) (*model.Craftsmanship, error) {
	var c model.Craftsmanship
	var coverID sql.NullInt64
	var mFilename, mOrig, mAlt, mMime, mSHA, mCreated sql.NullString
	var mSize sql.NullInt64
	var mW, mH sql.NullInt64
	var publishedAt sql.NullString
	err := row.Scan(&c.ID, &c.Title, &c.Slug, &c.Summary, &c.Body, &coverID,
		&mFilename, &mOrig, &mAlt, &mMime, &mSize, &mW, &mH, &mSHA, &mCreated,
		&c.VideoURL, &c.SortOrder, &c.Status, &c.SEOTitle, &c.SEODesc,
		&c.CreatedAt, &c.UpdatedAt, &publishedAt)
	if err != nil {
		return nil, err
	}
	c.CoverImageID = ni(coverID)
	if mFilename.Valid {
		c.CoverImage = &model.Media{
			Filename: mFilename.String, URL: mediaURL(mFilename.String),
			OriginalName: mOrig.String, AltText: mAlt.String, MimeType: mMime.String,
			SizeBytes: mSize.Int64, Width: nint(mW), Height: nint(mH),
			SHA256: mSHA.String, CreatedAt: mCreated.String,
		}
	}
	c.PublishedAt = ns(publishedAt)
	return &c, nil
}

// ListPublic 已发布列表。
func (r *CraftRepo) ListPublic() ([]model.Craftsmanship, error) {
	rows, err := r.db.Query(`SELECT ` + craftCols + ` ` + craftFrom + ` WHERE c.status='published' ORDER BY c.sort_order, c.id`)
	if err != nil {
		return nil, err
	}
	return collectCrafts(rows)
}

// ListAdmin 全部。
func (r *CraftRepo) ListAdmin() ([]model.Craftsmanship, error) {
	rows, err := r.db.Query(`SELECT ` + craftCols + ` ` + craftFrom + ` ORDER BY c.sort_order, c.id`)
	if err != nil {
		return nil, err
	}
	return collectCrafts(rows)
}

func collectCrafts(rows *sql.Rows) ([]model.Craftsmanship, error) {
	defer rows.Close()
	var out []model.Craftsmanship
	for rows.Next() {
		c, err := scanCraftRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *c)
	}
	return out, rows.Err()
}

// getRow 单条查询辅助。
func (r *CraftRepo) getRow(query string, arg any) (*model.Craftsmanship, error) {
	row := r.db.QueryRow(query, arg)
	c, err := scanCraftRow(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return c, err
}

func (r *CraftRepo) GetPublicBySlug(slug string) (*model.Craftsmanship, error) {
	c, err := r.getRow(`SELECT `+craftCols+` `+craftFrom+` WHERE c.slug = ? AND c.status='published'`, slug)
	if err != nil || c == nil {
		return c, err
	}
	imgs, err := r.media.ListForCraft(c.ID)
	if err != nil {
		return nil, err
	}
	c.Images = imgs
	return c, nil
}

func (r *CraftRepo) GetByID(id int64) (*model.Craftsmanship, error) {
	c, err := r.getRow(`SELECT `+craftCols+` `+craftFrom+` WHERE c.id = ?`, id)
	if err != nil || c == nil {
		return c, err
	}
	imgs, err := r.media.ListForCraft(c.ID)
	if err != nil {
		return nil, err
	}
	c.Images = imgs
	return c, nil
}

func (r *CraftRepo) GetBySlug(slug string) (*model.Craftsmanship, error) {
	return r.getRow(`SELECT `+craftCols+` `+craftFrom+` WHERE c.slug = ?`, slug)
}

func (r *CraftRepo) Create(c *model.Craftsmanship) (int64, error) {
	now := Now()
	res, err := r.db.Exec(`INSERT INTO craftsmanship(title, slug, summary, body, cover_image_id, video_url, sort_order, status, seo_title, seo_desc, created_at, updated_at, published_at)
		VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		c.Title, c.Slug, c.Summary, c.Body, c.CoverImageID, c.VideoURL, c.SortOrder, c.Status, c.SEOTitle, c.SEODesc, now, now, c.PublishedAt)
	if err != nil {
		return 0, err
	}
	id, err := res.LastInsertId()
	c.ID = id
	c.CreatedAt = now
	c.UpdatedAt = now
	return id, err
}

func (r *CraftRepo) Update(c *model.Craftsmanship) error {
	c.UpdatedAt = Now()
	_, err := r.db.Exec(`UPDATE craftsmanship SET title=?, slug=?, summary=?, body=?, cover_image_id=?, video_url=?, sort_order=?, status=?, seo_title=?, seo_desc=?, updated_at=?, published_at=? WHERE id=?`,
		c.Title, c.Slug, c.Summary, c.Body, c.CoverImageID, c.VideoURL, c.SortOrder, c.Status, c.SEOTitle, c.SEODesc, c.UpdatedAt, c.PublishedAt, c.ID)
	return err
}

func (r *CraftRepo) Delete(id int64) error {
	_, err := r.db.Exec(`DELETE FROM craftsmanship WHERE id = ?`, id)
	return err
}

// Count 按状态统计（dashboard 用）。
func (r *CraftRepo) Count(status string) (int64, error) {
	var n int64
	var err error
	if status == "" {
		err = r.db.QueryRow(`SELECT COUNT(*) FROM craftsmanship`).Scan(&n)
	} else {
		err = r.db.QueryRow(`SELECT COUNT(*) FROM craftsmanship WHERE status = ?`, status).Scan(&n)
	}
	return n, err
}

// SitemapEntries 全部 published 工艺（sitemap 用）。
func (r *CraftRepo) SitemapEntries() ([]SitemapEntry, error) {
	rows, err := r.db.Query(`SELECT slug, COALESCE(published_at, updated_at) FROM craftsmanship WHERE status='published'`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []SitemapEntry
	for rows.Next() {
		var e SitemapEntry
		if err := rows.Scan(&e.Slug, &e.LastMod); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}
