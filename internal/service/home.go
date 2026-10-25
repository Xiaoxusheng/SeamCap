package service

import (
	"strings"

	"seamcap/internal/apperr"
	"seamcap/internal/model"
	"seamcap/internal/repository"
)

// HomeService 首页内容业务逻辑。
type HomeService struct {
	repo   *repository.HomeRepo
	media  *repository.MediaRepo
	prods  *repository.ProductRepo
	crafts *repository.CraftRepo
}

func NewHomeService(repo *repository.HomeRepo, media *repository.MediaRepo, prods *repository.ProductRepo, crafts *repository.CraftRepo) *HomeService {
	return &HomeService{repo, media, prods, crafts}
}

// HomeResponse 公开首页聚合数据。
type HomeResponse struct {
	Hero         model.HomeContent     `json:"hero"`
	Featured     []model.Product       `json:"featured_products"`
	CraftPreview []model.Craftsmanship `json:"craft_preview"`
}

// GetPublic 首页聚合：hero、featured_products（≤8）、craft_preview（≤4）。
func (s *HomeService) GetPublic() (*HomeResponse, error) {
	h, err := s.repo.Get()
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	featured, err := s.prods.Featured(8)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	crafts, err := s.crafts.ListPublic()
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	if len(crafts) > 4 {
		crafts = crafts[:4]
	}
	if featured == nil {
		featured = []model.Product{}
	}
	if crafts == nil {
		crafts = []model.Craftsmanship{}
	}
	s.resolveStoryMedia(h)
	return &HomeResponse{Hero: *h, Featured: featured, CraftPreview: crafts}, nil
}

// resolveStoryMedia 将工厂实景图库的媒体 ID 解析为公开端 {kind,url}（缺失的媒体跳过）。
func (s *HomeService) resolveStoryMedia(h *model.HomeContent) {
	h.StoryMedia = []model.StoryMediaItem{}
	for _, id := range h.StoryMediaIDs {
		m, err := s.media.GetByID(id)
		if err != nil || m == nil {
			continue
		}
		kind := "image"
		if strings.HasPrefix(m.MimeType, "video") {
			kind = "video"
		}
		h.StoryMedia = append(h.StoryMedia, model.StoryMediaItem{Kind: kind, URL: m.URL})
	}
}

// GetAdmin 管理读取。
func (s *HomeService) GetAdmin() (*model.HomeContent, error) {
	h, err := s.repo.Get()
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	return h, nil
}

// HomeInput 管理更新入参。
type HomeInput struct {
	HeroTitle    string `json:"hero_title"`
	HeroSubtitle string `json:"hero_subtitle"`
	HeroImageID  *int64 `json:"hero_image_id"`
	HeroVideoURL string `json:"hero_video_url"`
	CTA1Text     string `json:"cta1_text"`
	CTA1URL      string `json:"cta1_url"`
	CTA2Text     string `json:"cta2_text"`
	CTA2URL      string `json:"cta2_url"`
	FactoryIntro string `json:"factory_intro"`
	ContactBlurb string `json:"contact_blurb"`
	Advantages   []model.Advantage   `json:"advantages"`
	ProcessSteps []model.ProcessStep `json:"process_steps"`
	StoryMediaIDs []int64            `json:"story_media_ids"`
	CircleImageID *int64             `json:"circle_image_id"`
	FooterText   string              `json:"footer_text"`
}

// Update 管理更新（JSON 数组落库前校验）。
func (s *HomeService) Update(in HomeInput) (*model.HomeContent, error) {
	if in.Advantages == nil {
		in.Advantages = []model.Advantage{}
	}
	if in.ProcessSteps == nil {
		in.ProcessSteps = []model.ProcessStep{}
	}
	if in.StoryMediaIDs == nil {
		in.StoryMediaIDs = []int64{}
	}
	if len(in.Advantages) > 12 {
		return nil, apperr.InvalidField("advantages", "max 12 items")
	}
	if len(in.ProcessSteps) > 12 {
		return nil, apperr.InvalidField("process_steps", "max 12 items")
	}
	if len(in.StoryMediaIDs) > 12 {
		return nil, apperr.InvalidField("story_media_ids", "max 12 items")
	}
	for _, id := range in.StoryMediaIDs {
		m, err := s.media.GetByID(id)
		if err != nil {
			return nil, apperr.Internal(err.Error())
		}
		if m == nil {
			return nil, apperr.InvalidField("story_media_ids", "media not found")
		}
	}
	for _, a := range in.Advantages {
		if charCount(a.Title) > 200 || charCount(a.Desc) > 1000 || charCount(a.Image) > 500 {
			return nil, apperr.InvalidField("advantages", "item fields too long (title≤200, desc≤1000, image≤500)")
		}
	}
	for _, st := range in.ProcessSteps {
		if charCount(st.Step) > 100 || charCount(st.Desc) > 500 ||
			charCount(st.Image) > 500 || charCount(st.VideoURL) > 500 {
			return nil, apperr.InvalidField("process_steps", "item fields too long (step≤100, desc≤500, image≤500, video_url≤500)")
		}
	}
	if charCount(in.HeroTitle) > 200 || charCount(in.HeroSubtitle) > 300 || charCount(in.HeroVideoURL) > 500 {
		return nil, apperr.InvalidField("hero", "hero fields too long (title≤200, subtitle≤300, video_url≤500)")
	}
	if charCount(in.CTA1Text) > 100 || charCount(in.CTA1URL) > 500 ||
		charCount(in.CTA2Text) > 100 || charCount(in.CTA2URL) > 500 {
		return nil, apperr.InvalidField("cta", "cta fields too long (text≤100, url≤500)")
	}
	if charCount(in.FactoryIntro) > 2000 || charCount(in.ContactBlurb) > 1000 || charCount(in.FooterText) > 500 {
		return nil, apperr.InvalidField("content", "content too long (factory_intro≤2000, contact_blurb≤1000, footer_text≤500)")
	}
	if in.HeroImageID != nil {
		m, err := s.media.GetByID(*in.HeroImageID)
		if err != nil {
			return nil, apperr.Internal(err.Error())
		}
		if m == nil {
			return nil, apperr.InvalidField("hero_image_id", "media not found")
		}
	}
	if in.CircleImageID != nil {
		m, err := s.media.GetByID(*in.CircleImageID)
		if err != nil {
			return nil, apperr.Internal(err.Error())
		}
		if m == nil {
			return nil, apperr.InvalidField("circle_image_id", "media not found")
		}
	}
	h := &model.HomeContent{
		HeroTitle: in.HeroTitle, HeroSubtitle: in.HeroSubtitle, HeroImageID: in.HeroImageID,
		HeroVideoURL: in.HeroVideoURL, CTA1Text: in.CTA1Text, CTA1URL: in.CTA1URL,
		CTA2Text: in.CTA2Text, CTA2URL: in.CTA2URL, FactoryIntro: in.FactoryIntro,
		ContactBlurb: in.ContactBlurb, Advantages: in.Advantages, ProcessSteps: in.ProcessSteps,
		StoryMediaIDs: in.StoryMediaIDs, CircleImageID: in.CircleImageID, FooterText: in.FooterText,
	}
	if err := s.repo.Update(h); err != nil {
		return nil, apperr.Internal(err.Error())
	}
	return s.repo.Get()
}
