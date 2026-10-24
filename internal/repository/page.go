package repository

import (
	"database/sql"
	"errors"

	"seamcap/internal/model"
)

// PageRepo pages。
type PageRepo struct{ db *DB }

func NewPageRepo(db *DB) *PageRepo { return &PageRepo{db} }

const pageCols = `id, slug, title, COALESCE(body,''), status, COALESCE(seo_title,''), COALESCE(seo_desc,''), created_at, updated_at`

func scanPage(row interface{ Scan(...any) error }) (*model.Page, error) {
	var p model.Page
	err := row.Scan(&p.ID, &p.Slug, &p.Title, &p.Body, &p.Status, &p.SEOTitle, &p.SEODesc, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// GetPublicBySlug 仅 published。
func (r *PageRepo) GetPublicBySlug(slug string) (*model.Page, error) {
	row := r.db.QueryRow(`SELECT `+pageCols+` FROM pages WHERE slug = ? AND status='published'`, slug)
	p, err := scanPage(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return p, err
}

// GetBySlug 任意状态。
func (r *PageRepo) GetBySlug(slug string) (*model.Page, error) {
	row := r.db.QueryRow(`SELECT `+pageCols+` FROM pages WHERE slug = ?`, slug)
	p, err := scanPage(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return p, err
}

// List 全部页面（管理端）。
func (r *PageRepo) List() ([]model.Page, error) {
	rows, err := r.db.Query(`SELECT ` + pageCols + ` FROM pages ORDER BY slug`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []model.Page
	for rows.Next() {
		p, err := scanPage(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *p)
	}
	return out, rows.Err()
}

func (r *PageRepo) Count() (int, error) {
	var n int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM pages`).Scan(&n)
	return n, err
}

// Upsert 创建或更新页面（PUT /admin/pages/{slug} 语义）。
func (r *PageRepo) Upsert(p *model.Page) error {
	now := Now()
	existing, err := r.GetBySlug(p.Slug)
	if err != nil {
		return err
	}
	if existing == nil {
		res, err := r.db.Exec(`INSERT INTO pages(slug, title, body, status, seo_title, seo_desc, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?)`,
			p.Slug, p.Title, p.Body, p.Status, p.SEOTitle, p.SEODesc, now, now)
		if err != nil {
			return err
		}
		id, err := res.LastInsertId()
		if err != nil {
			return err
		}
		p.ID = id
		p.CreatedAt = now
		p.UpdatedAt = now
		return nil
	}
	p.ID = existing.ID
	p.CreatedAt = existing.CreatedAt
	p.UpdatedAt = now
	_, err = r.db.Exec(`UPDATE pages SET title=?, body=?, status=?, seo_title=?, seo_desc=?, updated_at=? WHERE id=?`,
		p.Title, p.Body, p.Status, p.SEOTitle, p.SEODesc, now, p.ID)
	return err
}

// ListPublishedSitemap sitemap 用：全部 published 页面。
func (r *PageRepo) ListPublished() ([]model.Page, error) {
	rows, err := r.db.Query(`SELECT ` + pageCols + ` FROM pages WHERE status='published' ORDER BY slug`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []model.Page
	for rows.Next() {
		p, err := scanPage(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *p)
	}
	return out, rows.Err()
}
