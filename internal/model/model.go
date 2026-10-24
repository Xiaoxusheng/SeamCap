// Package model 定义实体结构体（时间统一存 UTC RFC3339 文本）。
package model

// AdminUser 管理员。
type AdminUser struct {
	ID           int64  `json:"id"`
	Username     string `json:"username"`
	PasswordHash string `json:"-"`
	CreatedAt    string `json:"created_at"`
	UpdatedAt    string `json:"updated_at"`
}

// Session 数据库会话（token 仅存 SHA-256）。
type Session struct {
	ID        int64  `json:"-"`
	TokenHash string `json:"-"`
	AdminID   int64  `json:"-"`
	IP        string `json:"-"`
	UserAgent string `json:"-"`
	Remember  bool   `json:"-"`
	ExpiresAt string `json:"-"`
	CreatedAt string `json:"-"`
}

// Category 产品分类。
type Category struct {
	ID          int64   `json:"id"`
	Name        string  `json:"name"`
	NameEn      string  `json:"name_en"`
	Slug        string  `json:"slug"`
	Description string  `json:"description"`
	ImageID     *int64  `json:"image_id"`
	Image       *Media  `json:"image,omitempty"`
	SortOrder   int     `json:"sort_order"`
	Status      string  `json:"status"` // active | inactive
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`
	ProductCount int64  `json:"product_count,omitempty"`
}

// Media 媒体资产。
type Media struct {
	ID           int64   `json:"id"`
	Filename     string  `json:"filename"`
	URL          string  `json:"url"`
	OriginalName string  `json:"original_name"`
	AltText      string  `json:"alt_text"`
	MimeType     string  `json:"mime_type"`
	SizeBytes    int64   `json:"size_bytes"`
	Width        *int    `json:"width"`
	Height       *int    `json:"height"`
	SHA256       string  `json:"sha256"`
	CreatedAt    string  `json:"created_at"`
	Role         string  `json:"role,omitempty"` // 仅产品/工艺媒体关联查询时填充
	SortOrder    int     `json:"sort_order,omitempty"`
}

// MediaLink 产品/工艺与媒体的关联。
type MediaLink struct {
	MediaID   int64 `json:"media_id"`
	Role      string `json:"role,omitempty"`
	SortOrder int   `json:"sort_order"`
}

// Product 产品。
type Product struct {
	ID            int64     `json:"id"`
	Name          string    `json:"name"`
	SKU           string    `json:"sku"`
	Slug          string    `json:"slug"`
	CategoryID    *int64    `json:"category_id"`
	Category      *Category `json:"category,omitempty"`
	ShortDesc     string    `json:"short_desc"`
	DetailDesc    string    `json:"detail_desc"`
	Material      string    `json:"material"`
	CapShape      string    `json:"cap_shape"`
	Colors        string    `json:"colors"`
	Sizes         string    `json:"sizes"`
	Customization string    `json:"customization"`
	MainImageID   *int64    `json:"main_image_id"`
	MainImage     *Media    `json:"main_image,omitempty"`
	VideoURL      string    `json:"video_url"`
	IsFeatured    bool      `json:"is_featured"`
	SortOrder     int       `json:"sort_order"`
	Status        string    `json:"status"` // draft | published | archived
	SEOTitle      string    `json:"seo_title"`
	SEODesc       string    `json:"seo_desc"`
	CreatedAt     string    `json:"created_at"`
	UpdatedAt     string    `json:"updated_at"`
	PublishedAt   *string   `json:"published_at"`

	// 关联查询结果
	Images   []Media   `json:"images,omitempty"`
	Related  []Product `json:"related_products,omitempty"`
}

// Craftsmanship 工艺内容。
type Craftsmanship struct {
	ID            int64   `json:"id"`
	Title         string  `json:"title"`
	Slug          string  `json:"slug"`
	Summary       string  `json:"summary"`
	Body          string  `json:"body"`
	CoverImageID  *int64  `json:"cover_image_id"`
	CoverImage    *Media  `json:"cover_image,omitempty"`
	VideoURL      string  `json:"video_url"`
	SortOrder     int     `json:"sort_order"`
	Status        string  `json:"status"` // draft | published | hidden
	SEOTitle      string  `json:"seo_title"`
	SEODesc       string  `json:"seo_desc"`
	CreatedAt     string  `json:"created_at"`
	UpdatedAt     string  `json:"updated_at"`
	PublishedAt   *string `json:"published_at"`

	Images []Media `json:"images,omitempty"`
}

// Page 普通页面（受控 HTML）。
type Page struct {
	ID        int64  `json:"id"`
	Slug      string `json:"slug"`
	Title     string `json:"title"`
	Body      string `json:"body"`
	Status    string `json:"status"` // draft | published
	SEOTitle  string `json:"seo_title"`
	SEODesc   string `json:"seo_desc"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

// Advantage 首页优势项。
type Advantage struct {
	Title string `json:"title"`
	Desc  string `json:"desc"`
	Image string `json:"image"`
}

// ProcessStep 首页流程步骤。
type ProcessStep struct {
	Step     string `json:"step"`
	Desc     string `json:"desc"`
	Image    string `json:"image"`
	VideoURL string `json:"video_url"`
}

// HomeContent 首页内容（单行 id=1）。
type HomeContent struct {
	HeroTitle     string `json:"hero_title"`
	HeroSubtitle  string `json:"hero_subtitle"`
	HeroImageID   *int64 `json:"hero_image_id"`
	HeroImage     *Media `json:"hero_image,omitempty"`
	HeroVideoURL  string `json:"hero_video_url"`
	CTA1Text      string `json:"cta1_text"`
	CTA1URL       string `json:"cta1_url"`
	CTA2Text      string `json:"cta2_text"`
	CTA2URL       string `json:"cta2_url"`
	FactoryIntro  string `json:"factory_intro"`
	ContactBlurb  string `json:"contact_blurb"`
	Advantages    []Advantage   `json:"advantages"`
	ProcessSteps  []ProcessStep `json:"process_steps"`
	FooterText    string        `json:"footer_text"`
	UpdatedAt     string        `json:"updated_at"`
}

// Inquiry 询价。
type Inquiry struct {
	ID                  int64   `json:"id"`
	Name                string  `json:"name"`
	Company             string  `json:"company"`
	Email               string  `json:"email"`
	WhatsAppPhone       string  `json:"whatsapp_phone"`
	ProductID           *int64  `json:"product_id"`
	ProductNameSnapshot string  `json:"product_name_snapshot"`
	ProductSKUSnapshot  string  `json:"product_sku_snapshot"`
	SourcePage          string  `json:"source_page"`
	EstimatedQty        string  `json:"estimated_qty"`
	Customization       string  `json:"customization"`
	Message             string  `json:"message"`
	Status              string  `json:"status"` // new|following|replied|completed|spam
	InternalNote        string  `json:"internal_note"`
	HandledBy           *int64  `json:"handled_by"`
	HandledAt           *string `json:"handled_at"`
	EmailNotifyStatus   string  `json:"email_notify_status"`
	IP                  string  `json:"ip"`
	UserAgent           string  `json:"user_agent"`
	CreatedAt           string  `json:"created_at"`
	UpdatedAt           string  `json:"updated_at"`
}

// InquiryEvent 询价事件历史。
type InquiryEvent struct {
	ID        int64   `json:"id"`
	InquiryID int64   `json:"inquiry_id"`
	EventType string  `json:"event_type"` // created/status_changed/note/notify
	FromStatus string `json:"from_status"`
	ToStatus  string  `json:"to_status"`
	AdminID   *int64  `json:"admin_id"`
	Detail    string  `json:"detail"`
	CreatedAt string  `json:"created_at"`
}

// AuditLog 审计日志。
type AuditLog struct {
	ID         int64  `json:"id"`
	AdminID    *int64 `json:"admin_id"`
	Action     string `json:"action"`
	EntityType string `json:"entity_type"`
	EntityID   string `json:"entity_id"`
	Detail     string `json:"detail"`
	IP         string `json:"ip"`
	CreatedAt  string `json:"created_at"`
}

// Pagination 分页信息。
type Pagination struct {
	Page    int   `json:"page"`
	PerPage int   `json:"per_page"`
	Total   int64 `json:"total"`
}
