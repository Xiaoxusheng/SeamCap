package repository

import (
	"database/sql"
	"encoding/json"
	"errors"

	"seamcap/internal/model"
)

// HomeRepo home_content（单行 id=1）。
type HomeRepo struct{ db *DB }

func NewHomeRepo(db *DB) *HomeRepo { return &HomeRepo{db} }

const homeCols = `COALESCE(h.hero_title,''), COALESCE(h.hero_subtitle,''), h.hero_image_id,
	m.id, m.filename, m.original_name, m.alt_text, m.mime_type, m.size_bytes, m.width, m.height, m.sha256, m.created_at,
	COALESCE(h.hero_video_url,''), COALESCE(h.cta1_text,''), COALESCE(h.cta1_url,''), COALESCE(h.cta2_text,''), COALESCE(h.cta2_url,''),
	COALESCE(h.factory_intro,''), COALESCE(h.contact_blurb,''), COALESCE(h.advantages_json,'[]'), COALESCE(h.process_steps_json,'[]'),
	COALESCE(h.footer_text,''), h.updated_at`

const homeFrom = `FROM home_content h LEFT JOIN media_assets m ON m.id = h.hero_image_id`

func scanHome(row interface{ Scan(...any) error }) (*model.HomeContent, error) {
	var h model.HomeContent
	var heroID sql.NullInt64
	var mID sql.NullInt64
	var mFilename, mOrig, mAlt, mMime, mSHA, mCreated sql.NullString
	var mSize sql.NullInt64
	var mW, mH sql.NullInt64
	var advJSON, stepsJSON string
	err := row.Scan(&h.HeroTitle, &h.HeroSubtitle, &heroID,
		&mID, &mFilename, &mOrig, &mAlt, &mMime, &mSize, &mW, &mH, &mSHA, &mCreated,
		&h.HeroVideoURL, &h.CTA1Text, &h.CTA1URL, &h.CTA2Text, &h.CTA2URL,
		&h.FactoryIntro, &h.ContactBlurb, &advJSON, &stepsJSON,
		&h.FooterText, &h.UpdatedAt)
	if err != nil {
		return nil, err
	}
	h.HeroImageID = ni(heroID)
	if mFilename.Valid {
		h.HeroImage = &model.Media{
			ID:       mID.Int64,
			Filename: mFilename.String, URL: mediaURL(mFilename.String),
			OriginalName: mOrig.String, AltText: mAlt.String, MimeType: mMime.String,
			SizeBytes: mSize.Int64, Width: nint(mW), Height: nint(mH),
			SHA256: mSHA.String, CreatedAt: mCreated.String,
		}
	}
	_ = json.Unmarshal([]byte(advJSON), &h.Advantages)
	_ = json.Unmarshal([]byte(stepsJSON), &h.ProcessSteps)
	if h.Advantages == nil {
		h.Advantages = []model.Advantage{}
	}
	if h.ProcessSteps == nil {
		h.ProcessSteps = []model.ProcessStep{}
	}
	return &h, nil
}

// Get 读取首页内容；不存在时创建默认空行。
func (r *HomeRepo) Get() (*model.HomeContent, error) {
	row := r.db.QueryRow(`SELECT ` + homeCols + ` ` + homeFrom + ` WHERE h.id = 1`)
	h, err := scanHome(row)
	if errors.Is(err, sql.ErrNoRows) {
		now := Now()
		if _, err := r.db.Exec(`INSERT OR IGNORE INTO home_content(id, advantages_json, process_steps_json, updated_at) VALUES(1,'[]','[]',?)`, now); err != nil {
			return nil, err
		}
		return r.Get()
	}
	if err != nil {
		return nil, err
	}
	return h, nil
}

// Update 更新单行（不存在则插入）。
func (r *HomeRepo) Update(h *model.HomeContent) error {
	advJSON, err := json.Marshal(h.Advantages)
	if err != nil {
		return err
	}
	stepsJSON, err := json.Marshal(h.ProcessSteps)
	if err != nil {
		return err
	}
	now := Now()
	res, err := r.db.Exec(`UPDATE home_content SET hero_title=?, hero_subtitle=?, hero_image_id=?, hero_video_url=?,
		cta1_text=?, cta1_url=?, cta2_text=?, cta2_url=?, factory_intro=?, contact_blurb=?,
		advantages_json=?, process_steps_json=?, footer_text=?, updated_at=? WHERE id=1`,
		h.HeroTitle, h.HeroSubtitle, h.HeroImageID, h.HeroVideoURL,
		h.CTA1Text, h.CTA1URL, h.CTA2Text, h.CTA2URL, h.FactoryIntro, h.ContactBlurb,
		string(advJSON), string(stepsJSON), h.FooterText, now)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		_, err = r.db.Exec(`INSERT INTO home_content(id, hero_title, hero_subtitle, hero_image_id, hero_video_url,
			cta1_text, cta1_url, cta2_text, cta2_url, factory_intro, contact_blurb, advantages_json, process_steps_json, footer_text, updated_at)
			VALUES(1,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
			h.HeroTitle, h.HeroSubtitle, h.HeroImageID, h.HeroVideoURL,
			h.CTA1Text, h.CTA1URL, h.CTA2Text, h.CTA2URL, h.FactoryIntro, h.ContactBlurb,
			string(advJSON), string(stepsJSON), h.FooterText, now)
	}
	if err == nil {
		h.UpdatedAt = now
	}
	return err
}
