package repository

import (
	"database/sql"
	"errors"

	"seamcap/internal/model"
)

// MediaRepo media_assets + 产品/工艺媒体关联。
type MediaRepo struct{ db *DB }

func NewMediaRepo(db *DB) *MediaRepo { return &MediaRepo{db} }

func mediaURL(filename string) string { return "/uploads/" + filename }

const mediaCols = `id, filename, original_name, COALESCE(alt_text,''), mime_type, size_bytes, width, height, sha256, created_at`

func scanMedia(row interface{ Scan(...any) error }) (*model.Media, error) {
	var m model.Media
	var w, h sql.NullInt64
	if err := row.Scan(&m.ID, &m.Filename, &m.OriginalName, &m.AltText, &m.MimeType,
		&m.SizeBytes, &w, &h, &m.SHA256, &m.CreatedAt); err != nil {
		return nil, err
	}
	m.Width = nint(w)
	m.Height = nint(h)
	m.URL = mediaURL(m.Filename)
	return &m, nil
}

func (r *MediaRepo) Create(m *model.Media) (int64, error) {
	res, err := r.db.Exec(`INSERT INTO media_assets(filename, original_name, alt_text, mime_type, size_bytes, width, height, sha256, created_at)
		VALUES(?,?,?,?,?,?,?,?,?)`,
		m.Filename, m.OriginalName, m.AltText, m.MimeType, m.SizeBytes, m.Width, m.Height, m.SHA256, Now())
	if err != nil {
		return 0, err
	}
	id, err := res.LastInsertId()
	m.ID = id
	m.CreatedAt = Now()
	return id, err
}

func (r *MediaRepo) GetByID(id int64) (*model.Media, error) {
	row := r.db.QueryRow(`SELECT `+mediaCols+` FROM media_assets WHERE id = ?`, id)
	m, err := scanMedia(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return m, err
}

// GetBySHA256 按内容哈希查询（去重）。
func (r *MediaRepo) GetBySHA256(sha string) (*model.Media, error) {
	row := r.db.QueryRow(`SELECT `+mediaCols+` FROM media_assets WHERE sha256 = ? ORDER BY id LIMIT 1`, sha)
	m, err := scanMedia(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return m, err
}

func (r *MediaRepo) List(q string, page, perPage int) ([]model.Media, int64, error) {
	page, perPage = clampPage(page, perPage, 24)
	where := "1=1"
	args := []any{}
	if q != "" {
		where += ` AND (original_name LIKE ? OR alt_text LIKE ?)`
		pat := "%" + q + "%"
		args = append(args, pat, pat)
	}
	var total int64
	if err := r.db.QueryRow(`SELECT COUNT(*) FROM media_assets WHERE `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	query := `SELECT ` + mediaCols + ` FROM media_assets WHERE ` + where + ` ORDER BY id DESC LIMIT ? OFFSET ?`
	args = append(args, perPage, (page-1)*perPage)
	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var out []model.Media
	for rows.Next() {
		m, err := scanMedia(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, *m)
	}
	return out, total, rows.Err()
}

func (r *MediaRepo) UpdateAlt(id int64, alt string) error {
	_, err := r.db.Exec(`UPDATE media_assets SET alt_text = ? WHERE id = ?`, alt, id)
	return err
}

// ReplaceFile 替换文件元数据（文件本体由 storage 层处理）。
func (r *MediaRepo) ReplaceFile(id int64, filename, mimeType string, size int64, width, height *int, sha string) error {
	_, err := r.db.Exec(`UPDATE media_assets SET filename=?, mime_type=?, size_bytes=?, width=?, height=?, sha256=? WHERE id=?`,
		filename, mimeType, size, width, height, sha, id)
	return err
}

// RefCount 检查引用计数并列出来源描述；删除媒体前必须调用。
func (r *MediaRepo) RefCount(id int64) (int64, []string, error) {
	var n int64
	var refs []string
	add := func(n int64, label string) {
		if n > 0 {
			refs = append(refs, label)
		}
	}
	check := func(q string, label string) error {
		var c int64
		if err := r.db.QueryRow(q, id).Scan(&c); err != nil {
			return err
		}
		n += c
		add(c, label)
		return nil
	}
	if err := check(`SELECT COUNT(*) FROM products WHERE main_image_id = ?`, "products.main_image"); err != nil {
		return 0, nil, err
	}
	if err := check(`SELECT COUNT(*) FROM product_categories WHERE image_id = ?`, "categories.image"); err != nil {
		return 0, nil, err
	}
	if err := check(`SELECT COUNT(*) FROM product_media WHERE media_id = ?`, "products.gallery"); err != nil {
		return 0, nil, err
	}
	if err := check(`SELECT COUNT(*) FROM craftsmanship WHERE cover_image_id = ?`, "craftsmanship.cover"); err != nil {
		return 0, nil, err
	}
	if err := check(`SELECT COUNT(*) FROM craftsmanship_media WHERE media_id = ?`, "craftsmanship.gallery"); err != nil {
		return 0, nil, err
	}
	if err := check(`SELECT COUNT(*) FROM home_content WHERE hero_image_id = ?`, "home.hero"); err != nil {
		return 0, nil, err
	}
	return n, refs, nil
}

func (r *MediaRepo) Delete(id int64) error {
	_, err := r.db.Exec(`DELETE FROM media_assets WHERE id = ?`, id)
	return err
}

// ---- 产品媒体关联 ----

const productMediaCols = `m.id, m.filename, m.original_name, COALESCE(m.alt_text,''), m.mime_type, m.size_bytes, m.width, m.height, m.sha256, m.created_at, pm.role, pm.sort_order`

// scanMediaRole 扫描 media 列 + 关联表的 role/sort_order（共 12 列）。
func scanMediaRole(row interface{ Scan(...any) error }) (*model.Media, error) {
	var m model.Media
	var w, h sql.NullInt64
	if err := row.Scan(&m.ID, &m.Filename, &m.OriginalName, &m.AltText, &m.MimeType,
		&m.SizeBytes, &w, &h, &m.SHA256, &m.CreatedAt, &m.Role, &m.SortOrder); err != nil {
		return nil, err
	}
	m.Width = nint(w)
	m.Height = nint(h)
	m.URL = mediaURL(m.Filename)
	return &m, nil
}

// ListForProduct 返回产品关联媒体（含角色与排序）。
func (r *MediaRepo) ListForProduct(productID int64) ([]model.Media, error) {
	rows, err := r.db.Query(`SELECT `+productMediaCols+` FROM product_media pm JOIN media_assets m ON m.id = pm.media_id
		WHERE pm.product_id = ? ORDER BY pm.sort_order, pm.id`, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []model.Media
	for rows.Next() {
		m, err := scanMediaRole(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *m)
	}
	return out, rows.Err()
}

// SetProductMedia 整体替换产品媒体关联（重排/增删）。
func (r *MediaRepo) SetProductMedia(productID int64, links []model.MediaLink) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`DELETE FROM product_media WHERE product_id = ?`, productID); err != nil {
		return err
	}
	for _, l := range links {
		role := l.Role
		if role == "" {
			role = "gallery"
		}
		if _, err := tx.Exec(`INSERT INTO product_media(product_id, media_id, role, sort_order) VALUES(?,?,?,?)`,
			productID, l.MediaID, role, l.SortOrder); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// ---- 工艺媒体关联 ----

// craftMediaCols 工艺关联列（cm 别名；craftsmanship_media 无 role 列，以空串占位）
const craftMediaCols = `m.id, m.filename, m.original_name, COALESCE(m.alt_text,''), m.mime_type, m.size_bytes, m.width, m.height, m.sha256, m.created_at, '' AS role, cm.sort_order`

// ListForCraft 返回工艺关联媒体。
func (r *MediaRepo) ListForCraft(craftID int64) ([]model.Media, error) {
	rows, err := r.db.Query(`SELECT `+craftMediaCols+` FROM craftsmanship_media cm JOIN media_assets m ON m.id = cm.media_id
		WHERE cm.craftsmanship_id = ? ORDER BY cm.sort_order, cm.id`, craftID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []model.Media
	for rows.Next() {
		m, err := scanMediaRole(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *m)
	}
	return out, rows.Err()
}

func (r *MediaRepo) SetCraftMedia(craftID int64, links []model.MediaLink) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`DELETE FROM craftsmanship_media WHERE craftsmanship_id = ?`, craftID); err != nil {
		return err
	}
	for _, l := range links {
		if _, err := tx.Exec(`INSERT INTO craftsmanship_media(craftsmanship_id, media_id, sort_order) VALUES(?,?,?)`,
			craftID, l.MediaID, l.SortOrder); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// ---- 分类/首页/产品/工艺 关联图填充 ----

// FillCategoryImage 填充分类封面。
func (r *MediaRepo) FillCategoryImage(c *model.Category) error {
	if c.ImageID == nil {
		return nil
	}
	m, err := r.GetByID(*c.ImageID)
	if err != nil {
		return err
	}
	c.Image = m
	return nil
}

// FillProductMainImage 填充产品主图。
func (r *MediaRepo) FillProductMainImage(p *model.Product) error {
	if p.MainImageID == nil {
		return nil
	}
	m, err := r.GetByID(*p.MainImageID)
	if err != nil {
		return err
	}
	p.MainImage = m
	return nil
}

// FillCraftCover 填充工艺封面。
func (r *MediaRepo) FillCraftCover(c *model.Craftsmanship) error {
	if c.CoverImageID == nil {
		return nil
	}
	m, err := r.GetByID(*c.CoverImageID)
	if err != nil {
		return err
	}
	c.CoverImage = m
	return nil
}

// FillHomeHero 填充首页主图。
func (r *MediaRepo) FillHomeHero(h *model.HomeContent) error {
	if h.HeroImageID == nil {
		return nil
	}
	m, err := r.GetByID(*h.HeroImageID)
	if err != nil {
		return err
	}
	h.HeroImage = m
	return nil
}
