package repository

import (
	"database/sql"
	"errors"

	"seamcap/internal/model"
)

// ProductRepo products。
type ProductRepo struct {
	db     *DB
	media  *MediaRepo
}

func NewProductRepo(db *DB, media *MediaRepo) *ProductRepo { return &ProductRepo{db, media} }

// productJoinCols 带 category 与 main_image 左连接的完整列。
const productJoinCols = `
p.id, p.name, COALESCE(p.sku,''), p.slug, p.category_id,
c.id, c.name, COALESCE(c.name_en,''), c.slug,
COALESCE(p.short_desc,''), COALESCE(p.detail_desc,''), COALESCE(p.material,''), COALESCE(p.cap_shape,''),
COALESCE(p.colors,''), COALESCE(p.sizes,''), COALESCE(p.customization,''),
p.main_image_id, m.id, m.filename, m.original_name, COALESCE(m.alt_text,''), m.mime_type, m.size_bytes, m.width, m.height, m.sha256, m.created_at,
COALESCE(p.video_url,''), p.is_featured, p.sort_order, p.status, COALESCE(p.seo_title,''), COALESCE(p.seo_desc,''),
p.created_at, p.updated_at, p.published_at`

const productJoinFrom = `
FROM products p
LEFT JOIN product_categories c ON c.id = p.category_id
LEFT JOIN media_assets m ON m.id = p.main_image_id`

func scanProductJoin(row interface{ Scan(...any) error }) (*model.Product, error) {
	var p model.Product
	var catID, mainImgID sql.NullInt64
	var cID sql.NullInt64
	var mID sql.NullInt64
	var cName, cNameEn, cSlug sql.NullString
	var mFilename, mOrig, mAlt, mMime, mSHA, mCreated sql.NullString
	var mSize sql.NullInt64
	var mW, mH sql.NullInt64
	var publishedAt sql.NullString

	err := row.Scan(&p.ID, &p.Name, &p.SKU, &p.Slug, &catID,
		&cID, &cName, &cNameEn, &cSlug,
		&p.ShortDesc, &p.DetailDesc, &p.Material, &p.CapShape,
		&p.Colors, &p.Sizes, &p.Customization,
		&mainImgID, &mID, &mFilename, &mOrig, &mAlt, &mMime, &mSize, &mW, &mH, &mSHA, &mCreated,
		&p.VideoURL, &p.IsFeatured, &p.SortOrder, &p.Status, &p.SEOTitle, &p.SEODesc,
		&p.CreatedAt, &p.UpdatedAt, &publishedAt)
	if err != nil {
		return nil, err
	}
	p.CategoryID = ni(catID)
	p.MainImageID = ni(mainImgID)
	if cID.Valid {
		p.Category = &model.Category{ID: cID.Int64, Name: cName.String, NameEn: cNameEn.String, Slug: cSlug.String}
	}
	if mFilename.Valid {
		p.MainImage = &model.Media{
			ID:       mID.Int64,
			Filename: mFilename.String, URL: mediaURL(mFilename.String),
			OriginalName: mOrig.String, AltText: mAlt.String, MimeType: mMime.String,
			SizeBytes: mSize.Int64, Width: nint(mW), Height: nint(mH),
			SHA256: mSHA.String, CreatedAt: mCreated.String,
		}
	}
	p.PublishedAt = ns(publishedAt)
	return &p, nil
}

// ListPublic 公开产品列表：仅 published，支持关键词/分类/分页/排序。
func (r *ProductRepo) ListPublic(q string, categorySlug string, categoryID *int64, page, perPage int, sort string) ([]model.Product, int64, error) {
	page, perPage = clampPage(page, perPage, 12)
	where := `WHERE p.status = 'published'`
	args := []any{}
	if q != "" {
		where += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.short_desc LIKE ?)`
		pat := "%" + q + "%"
		args = append(args, pat, pat, pat)
	}
	if categorySlug != "" {
		where += ` AND c.slug = ?`
		args = append(args, categorySlug)
	}
	if categoryID != nil {
		where += ` AND p.category_id = ?`
		args = append(args, *categoryID)
	}
	order := `p.is_featured DESC, p.sort_order ASC, p.updated_at DESC` // recommended
	if sort == "updated" {
		order = `p.updated_at DESC`
	}

	var total int64
	if err := r.db.QueryRow(`SELECT COUNT(*) `+productJoinFrom+` `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	query := `SELECT ` + productJoinCols + ` ` + productJoinFrom + ` ` + where + ` ORDER BY ` + order + ` LIMIT ? OFFSET ?`
	args = append(args, perPage, (page-1)*perPage)
	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var out []model.Product
	for rows.Next() {
		p, err := scanProductJoin(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, *p)
	}
	return out, total, rows.Err()
}

// GetPublicBySlug 公开详情：仅 published。
func (r *ProductRepo) GetPublicBySlug(slug string) (*model.Product, error) {
	row := r.db.QueryRow(`SELECT `+productJoinCols+` `+productJoinFrom+` WHERE p.slug = ? AND p.status = 'published'`, slug)
	p, err := scanProductJoin(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if err := r.attachImages(p); err != nil {
		return nil, err
	}
	return p, nil
}

// ListAdmin 管理列表：含草稿，支持关键词/分类/状态/分页。
func (r *ProductRepo) ListAdmin(q string, categoryID *int64, status string, page, perPage int) ([]model.Product, int64, error) {
	page, perPage = clampPage(page, perPage, 20)
	where := "1=1"
	args := []any{}
	if q != "" {
		where += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.slug LIKE ?)`
		pat := "%" + q + "%"
		args = append(args, pat, pat, pat)
	}
	if categoryID != nil {
		where += ` AND p.category_id = ?`
		args = append(args, *categoryID)
	}
	if status != "" {
		where += ` AND p.status = ?`
		args = append(args, status)
	}
	var total int64
	if err := r.db.QueryRow(`SELECT COUNT(*) FROM products p WHERE `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	query := `SELECT ` + productJoinCols + ` ` + productJoinFrom + ` WHERE ` + where + ` ORDER BY p.updated_at DESC LIMIT ? OFFSET ?`
	args = append(args, perPage, (page-1)*perPage)
	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var out []model.Product
	for rows.Next() {
		p, err := scanProductJoin(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, *p)
	}
	return out, total, rows.Err()
}

// GetByID 无状态过滤。
func (r *ProductRepo) GetByID(id int64) (*model.Product, error) {
	row := r.db.QueryRow(`SELECT `+productJoinCols+` `+productJoinFrom+` WHERE p.id = ?`, id)
	p, err := scanProductJoin(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if err := r.attachImages(p); err != nil {
		return nil, err
	}
	return p, nil
}

// GetBySlug 任意状态。
func (r *ProductRepo) GetBySlug(slug string) (*model.Product, error) {
	row := r.db.QueryRow(`SELECT `+productJoinCols+` `+productJoinFrom+` WHERE p.slug = ?`, slug)
	p, err := scanProductJoin(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return p, err
}

func (r *ProductRepo) attachImages(p *model.Product) error {
	images, err := r.media.ListForProduct(p.ID)
	if err != nil {
		return err
	}
	p.Images = images
	return nil
}

// Create 新增产品。
func (r *ProductRepo) Create(p *model.Product) (int64, error) {
	now := Now()
	res, err := r.db.Exec(`INSERT INTO products(name, sku, slug, category_id, short_desc, detail_desc, material, cap_shape, colors, sizes, customization,
		main_image_id, video_url, is_featured, sort_order, status, seo_title, seo_desc, created_at, updated_at, published_at)
		VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		p.Name, p.SKU, p.Slug, p.CategoryID, p.ShortDesc, p.DetailDesc, p.Material, p.CapShape, p.Colors, p.Sizes, p.Customization,
		p.MainImageID, p.VideoURL, p.IsFeatured, p.SortOrder, p.Status, p.SEOTitle, p.SEODesc, now, now, p.PublishedAt)
	if err != nil {
		return 0, err
	}
	id, err := res.LastInsertId()
	p.ID = id
	p.CreatedAt = now
	p.UpdatedAt = now
	return id, err
}

// Update 更新产品（不含媒体关联）。
func (r *ProductRepo) Update(p *model.Product) error {
	now := Now()
	_, err := r.db.Exec(`UPDATE products SET name=?, sku=?, slug=?, category_id=?, short_desc=?, detail_desc=?, material=?, cap_shape=?, colors=?, sizes=?, customization=?,
		main_image_id=?, video_url=?, is_featured=?, sort_order=?, status=?, seo_title=?, seo_desc=?, updated_at=?, published_at=? WHERE id=?`,
		p.Name, p.SKU, p.Slug, p.CategoryID, p.ShortDesc, p.DetailDesc, p.Material, p.CapShape, p.Colors, p.Sizes, p.Customization,
		p.MainImageID, p.VideoURL, p.IsFeatured, p.SortOrder, p.Status, p.SEOTitle, p.SEODesc, now, p.PublishedAt, p.ID)
	if err == nil {
		p.UpdatedAt = now
	}
	return err
}

// Delete 删除产品（product_media 级联；询价 product_id 由 FK 置空，快照字段保留）。
func (r *ProductRepo) Delete(id int64) error {
	_, err := r.db.Exec(`DELETE FROM products WHERE id = ?`, id)
	return err
}

// RelatedProducts 相关产品：同分类优先，不足时以最新发布补齐。
func (r *ProductRepo) RelatedProducts(p *model.Product, limit int) ([]model.Product, error) {
	var out []model.Product
	if p.CategoryID != nil {
		rows, err := r.db.Query(`SELECT `+productJoinCols+` `+productJoinFrom+`
			WHERE p.status='published' AND p.id <> ? AND p.category_id = ?
			ORDER BY p.is_featured DESC, p.sort_order ASC LIMIT ?`, p.ID, *p.CategoryID, limit)
		if err != nil {
			return nil, err
		}
		out, err = collectProducts(rows)
		if err != nil {
			return nil, err
		}
	}
	if len(out) < limit {
		rows, err := r.db.Query(`SELECT `+productJoinCols+` `+productJoinFrom+`
			WHERE p.status='published' AND p.id <> ?
			ORDER BY p.updated_at DESC LIMIT ?`, p.ID, limit)
		if err != nil {
			return nil, err
		}
		more, err := collectProducts(rows)
		if err != nil {
			return nil, err
		}
		seen := map[int64]bool{p.ID: true}
		for _, o := range out {
			seen[o.ID] = true
		}
		for _, m := range more {
			if len(out) >= limit {
				break
			}
			if !seen[m.ID] {
				out = append(out, m)
				seen[m.ID] = true
			}
		}
	}
	return out, nil
}

func collectProducts(rows *sql.Rows) ([]model.Product, error) {
	defer rows.Close()
	var out []model.Product
	for rows.Next() {
		p, err := scanProductJoin(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *p)
	}
	return out, rows.Err()
}

// Featured 首页精选产品（published）。
func (r *ProductRepo) Featured(limit int) ([]model.Product, error) {
	rows, err := r.db.Query(`SELECT `+productJoinCols+` `+productJoinFrom+`
		WHERE p.status='published' AND p.is_featured=1
		ORDER BY p.sort_order ASC, p.updated_at DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	return collectProducts(rows)
}

// CountByStatus 按状态统计。
func (r *ProductRepo) CountByStatus() (draft, published, archived int64, err error) {
	rows, err := r.db.Query(`SELECT status, COUNT(*) FROM products GROUP BY status`)
	if err != nil {
		return 0, 0, 0, err
	}
	defer rows.Close()
	for rows.Next() {
		var s string
		var n int64
		if err := rows.Scan(&s, &n); err != nil {
			return 0, 0, 0, err
		}
		switch s {
		case "draft":
			draft = n
		case "published":
			published = n
		case "archived":
			archived = n
		}
	}
	return draft, published, archived, rows.Err()
}

// RecentUpdated 最近更新的 N 个产品。
func (r *ProductRepo) RecentUpdated(limit int) ([]model.Product, error) {
	rows, err := r.db.Query(`SELECT `+productJoinCols+` `+productJoinFrom+` ORDER BY p.updated_at DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	return collectProducts(rows)
}

// CountByCategory 各分类产品数（分类删除策略用）。
func (r *ProductRepo) CountByCategory() (map[int64]int64, error) {
	rows, err := r.db.Query(`SELECT category_id, COUNT(*) FROM products WHERE category_id IS NOT NULL GROUP BY category_id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[int64]int64{}
	for rows.Next() {
		var id, n int64
		if err := rows.Scan(&id, &n); err != nil {
			return nil, err
		}
		out[id] = n
	}
	return out, rows.Err()
}

// ReassignCategory 把 from 分类下的产品迁移到 to 分类。
func (r *ProductRepo) ReassignCategory(fromID, toID int64) (int64, error) {
	res, err := r.db.Exec(`UPDATE products SET category_id = ? WHERE category_id = ?`, toID, fromID)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// SitemapEntry sitemap 条目。
type SitemapEntry struct {
	Slug     string
	LastMod  string
}

// SitemapEntries 全部 published 产品（sitemap 用）。
func (r *ProductRepo) SitemapEntries() ([]SitemapEntry, error) {
	rows, err := r.db.Query(`SELECT slug, COALESCE(published_at, updated_at) FROM products WHERE status='published'`)
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
