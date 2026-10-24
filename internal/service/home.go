package service

import (
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
	return &HomeResponse{Hero: *h, Featured: featured, CraftPreview: crafts}, nil
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
	if len(in.Advantages) > 12 {
		return nil, apperr.InvalidField("advantages", "max 12 items")
	}
	if len(in.ProcessSteps) > 12 {
		return nil, apperr.InvalidField("process_steps", "max 12 items")
	}
	for _, a := range in.Advantages {
		if len(a.Title) > 200 || len(a.Desc) > 1000 || len(a.Image) > 500 {
			return nil, apperr.InvalidField("advantages", "item fields too long (title≤200, desc≤1000, image≤500)")
		}
	}
	for _, st := range in.ProcessSteps {
		if len(st.Step) > 100 || len(st.Desc) > 500 {
			return nil, apperr.InvalidField("process_steps", "item fields too long (step≤100, desc≤500)")
		}
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
	h := &model.HomeContent{
		HeroTitle: in.HeroTitle, HeroSubtitle: in.HeroSubtitle, HeroImageID: in.HeroImageID,
		HeroVideoURL: in.HeroVideoURL, CTA1Text: in.CTA1Text, CTA1URL: in.CTA1URL,
		CTA2Text: in.CTA2Text, CTA2URL: in.CTA2URL, FactoryIntro: in.FactoryIntro,
		ContactBlurb: in.ContactBlurb, Advantages: in.Advantages, ProcessSteps: in.ProcessSteps,
		FooterText: in.FooterText,
	}
	if err := s.repo.Update(h); err != nil {
		return nil, apperr.Internal(err.Error())
	}
	return s.repo.Get()
}
