package service

import (
	"encoding/json"
	"fmt"
	"strings"

	"seamcap/internal/apperr"
	"seamcap/internal/links"
	"seamcap/internal/repository"
)

// 已知设置键（白名单，其余忽略）。
var knownSettingKeys = map[string]int{
	"site_name": 500, "logo_url": 500, "whatsapp": 50, "email": 200, "phone": 50,
	"address": 500, "map_link": 1000, "social_links": 2000,
	"seo_title": 200, "seo_desc": 500, "whatsapp_text": 500,
}

// SettingsService 站点设置。
type SettingsService struct{ repo *repository.SettingsRepo }

func NewSettingsService(repo *repository.SettingsRepo) *SettingsService {
	return &SettingsService{repo}
}

// SiteResponse 公开站点信息。
type SiteResponse struct {
	SiteName      string            `json:"site_name"`
	LogoURL       string            `json:"logo_url"`
	WhatsApp      string            `json:"whatsapp"`       // 原始配置值
	WhatsAppLink  string            `json:"whatsapp_link"`  // 规范化 wa.me 链接
	WhatsAppText  string            `json:"whatsapp_text"`
	Email         string            `json:"email"`
	Phone         string            `json:"phone"`
	Address       string            `json:"address"`
	MapLink       string            `json:"map_link"`
	SocialLinks   map[string]string `json:"social_links"`
	SEOTitle      string            `json:"seo_title"`
	SEODesc       string            `json:"seo_desc"`
}

// Public 公开站点信息（含 WhatsApp 规范化链接）。
func (s *SettingsService) Public() (*SiteResponse, error) {
	kv, err := s.repo.GetAll()
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	social := map[string]string{}
	if raw := kv["social_links"]; raw != "" {
		_ = json.Unmarshal([]byte(raw), &social)
	}
	return &SiteResponse{
		SiteName:     kv["site_name"],
		LogoURL:      kv["logo_url"],
		WhatsApp:     kv["whatsapp"],
		WhatsAppLink: links.WhatsAppLink(kv["whatsapp"], kv["whatsapp_text"]),
		WhatsAppText: kv["whatsapp_text"],
		Email:        kv["email"],
		Phone:        kv["phone"],
		Address:      kv["address"],
		MapLink:      kv["map_link"],
		SocialLinks:  social,
		SEOTitle:     kv["seo_title"],
		SEODesc:      kv["seo_desc"],
	}, nil
}

// AdminGet 全部设置。
func (s *SettingsService) AdminGet() (map[string]string, error) {
	kv, err := s.repo.GetAll()
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	return kv, nil
}

// AdminSet 批量更新（仅白名单键；值超长或 social_links 非法 JSON 报错）。
func (s *SettingsService) AdminSet(kv map[string]string) (map[string]string, error) {
	fields := map[string]string{}
	clean := map[string]string{}
	for k, v := range kv {
		maxLen, ok := knownSettingKeys[k]
		if !ok {
			continue // 未知键忽略
		}
		if charCount(v) > maxLen {
			fields[k] = "max " + fmt.Sprint(maxLen) + " chars"
			continue
		}
		if k == "social_links" && strings.TrimSpace(v) != "" {
			var probe map[string]string
			if err := json.Unmarshal([]byte(v), &probe); err != nil {
				fields[k] = "must be a JSON object like {\"linkedin\":\"https://...\"}"
				continue
			}
		}
		if k == "whatsapp" && strings.TrimSpace(v) != "" {
			if links.NormalizeWhatsApp(v) == "" {
				fields[k] = "must contain digits (country code included), e.g. +8613388614562"
				continue
			}
		}
		clean[k] = v
	}
	if len(fields) > 0 {
		return nil, apperr.Invalid(fields)
	}
	if len(clean) > 0 {
		if err := s.repo.SetMany(clean); err != nil {
			return nil, apperr.Internal(err.Error())
		}
	}
	return s.AdminGet()
}

// EnsureDefaults 首次启动播种默认站点设置。
func (s *SettingsService) EnsureDefaults() error {
	kv, err := s.repo.GetAll()
	if err != nil {
		return err
	}
	if _, ok := kv["site_name"]; !ok {
		kv["site_name"] = "SeamCap"
	}
	// 依据项目素材预置工厂真实 WhatsApp（后台可改）
	if _, ok := kv["whatsapp"]; !ok {
		kv["whatsapp"] = "+8613388614562"
	}
	if _, ok := kv["whatsapp_text"]; !ok {
		kv["whatsapp_text"] = "Hello, I'd like to inquire about your caps."
	}
	return s.repo.SetMany(kv)
}
