package service

import (
	"seamcap/internal/apperr"
	"seamcap/internal/model"
	"seamcap/internal/repository"
)

// DashboardService 仪表盘统计（真实数据库统计）。
type DashboardService struct {
	products *repository.ProductRepo
	crafts   *repository.CraftRepo
	inqs     *repository.InquiryRepo
}

func NewDashboardService(products *repository.ProductRepo, crafts *repository.CraftRepo, inqs *repository.InquiryRepo) *DashboardService {
	return &DashboardService{products, crafts, inqs}
}

// DashboardResponse 仪表盘数据。
type DashboardResponse struct {
	Products struct {
		Published int64 `json:"published"`
		Draft     int64 `json:"draft"`
		Archived  int64 `json:"archived"`
	} `json:"products"`
	Craftsmanship struct {
		Total     int64 `json:"total"`
		Published int64 `json:"published"`
	} `json:"craftsmanship"`
	Inquiries struct {
		New int64 `json:"new"`
	} `json:"inquiries"`
	RecentInquiries []model.Inquiry `json:"recent_inquiries"`
	RecentProducts  []model.Product `json:"recent_products"`
}

// Get 聚合统计。
func (s *DashboardService) Get() (*DashboardResponse, error) {
	out := &DashboardResponse{}
	draft, published, archived, err := s.products.CountByStatus()
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	out.Products.Draft, out.Products.Published, out.Products.Archived = draft, published, archived

	craftTotal, err := s.crafts.Count("")
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	craftPublished, err := s.crafts.Count("published")
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	out.Craftsmanship.Total = craftTotal
	out.Craftsmanship.Published = craftPublished

	newInq, err := s.inqs.CountNew()
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	out.Inquiries.New = newInq

	if out.RecentInquiries, err = s.inqs.Recent(5); err != nil {
		return nil, apperr.Internal(err.Error())
	}
	if out.RecentProducts, err = s.products.RecentUpdated(5); err != nil {
		return nil, apperr.Internal(err.Error())
	}
	if out.RecentInquiries == nil {
		out.RecentInquiries = []model.Inquiry{}
	}
	if out.RecentProducts == nil {
		out.RecentProducts = []model.Product{}
	}
	return out, nil
}
