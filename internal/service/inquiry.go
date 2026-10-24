package service

import (
	"fmt"
	"log/slog"
	"net/mail"
	"regexp"
	"strings"
	"time"

	"seamcap/internal/apperr"
	"seamcap/internal/email"
	"seamcap/internal/model"
	"seamcap/internal/repository"
)

// InquiryService 询价业务逻辑。
type InquiryService struct {
	repo  *repository.InquiryRepo
	prods *repository.ProductRepo
	mail  *email.Sender

	// MinInterval 同 IP 最小提交间隔（生产 3s，测试可置 0）
	MinInterval time.Duration
	// MaxPerHour 每 IP 每小时最大提交数
	MaxPerHour int
}

func NewInquiryService(repo *repository.InquiryRepo, prods *repository.ProductRepo, mail *email.Sender, maxPerHour int) *InquiryService {
	return &InquiryService{repo: repo, prods: prods, mail: mail, MinInterval: 3 * time.Second, MaxPerHour: maxPerHour}
}

// InquiryInput 询价表单入参（Website 为 honeypot 字段，必须为空）。
type InquiryInput struct {
	Name          string `json:"name"`
	Company       string `json:"company"`
	Email         string `json:"email"`
	WhatsAppPhone string `json:"whatsapp_phone"`
	ProductID     *int64 `json:"product_id"`
	SourcePage    string `json:"source_page"`
	EstimatedQty  string `json:"estimated_qty"`
	Customization string `json:"customization"`
	Message       string `json:"message"`
	Website       string `json:"website"` // honeypot
}

var phoneRe = regexp.MustCompile(`^[0-9+()\-.\s]{5,30}$`)

// Submit 提交询价，按《04-后端开发文档》5.2 流程：
// 字段校验 → honeypot（伪装成功静默丢弃）→ 频率限制 → 产品快照 → 事务落库 → 异步邮件通知 → 201。
func (s *InquiryService) Submit(in InquiryInput, ip, ua string) (*model.Inquiry, error) {
	// ① 字段校验
	in.Name = strings.TrimSpace(in.Name)
	in.Email = strings.TrimSpace(in.Email)
	in.Message = strings.TrimSpace(in.Message)
	fields := map[string]string{}
	if in.Name == "" || charCount(in.Name) > 100 || strings.ContainsAny(in.Name, "\r\n") {
		fields["name"] = "required, max 100 chars, no line breaks"
	}
	if addr, err := mail.ParseAddress(in.Email); err != nil || addr.Address != in.Email || charCount(in.Email) > 200 {
		fields["email"] = "must be a valid email, max 200 chars"
	}
	if charCount(in.Message) < 10 || charCount(in.Message) > 5000 {
		fields["message"] = "must be 10-5000 chars"
	}
	for k, v := range map[string]*string{
		"company":        &in.Company,
		"whatsapp_phone": &in.WhatsAppPhone,
		"source_page":    &in.SourcePage,
		"estimated_qty":  &in.EstimatedQty,
		"customization":  &in.Customization,
	} {
		*v = strings.TrimSpace(*v)
		if charCount(*v) > 500 {
			fields[k] = "max 500 chars"
		}
	}
	if in.WhatsAppPhone != "" && !phoneRe.MatchString(in.WhatsAppPhone) {
		fields["whatsapp_phone"] = "invalid phone format"
	}
	if len(fields) > 0 {
		return nil, apperr.Invalid(fields)
	}

	// ② honeypot 非空 → 伪装成功返回（静默丢弃，不落库）
	if in.Website != "" {
		slog.Info("inquiry honeypot dropped", "ip", ip)
		now := repository.Now()
		return &model.Inquiry{ID: 0, CreatedAt: now}, nil
	}

	// ③ 提交间隔 <3s 同 IP → 429
	if last, err := s.repo.LastCreatedAtForIP(ip); err == nil && last != nil && s.MinInterval > 0 {
		if t, perr := time.Parse(time.RFC3339, *last); perr == nil {
			if time.Since(t) < s.MinInterval {
				return nil, apperr.RateLimited("Please wait a few seconds before submitting again")
			}
		}
	}

	// ④ IP 限流：N 次/小时/IP
	n, err := s.repo.CountByIPLastHour(ip)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	if s.MaxPerHour > 0 && n >= int64(s.MaxPerHour) {
		return nil, apperr.RateLimited("Submission limit reached, please try again later")
	}

	// ⑤ 产品快照：product_id 需存在且已发布，否则置空（不报错）
	var nameSnap, skuSnap string
	if in.ProductID != nil && *in.ProductID > 0 {
		p, err := s.prods.GetByID(*in.ProductID)
		if err != nil {
			return nil, apperr.Internal(err.Error())
		}
		if p == nil || p.Status != "published" {
			in.ProductID = nil
		} else {
			nameSnap = p.Name
			skuSnap = p.SKU
		}
	}

	// ⑥ 落库（事务：inquiries + inquiry_events[created]）
	q := &model.Inquiry{
		Name: in.Name, Company: in.Company, Email: in.Email, WhatsAppPhone: in.WhatsAppPhone,
		ProductID: in.ProductID, ProductNameSnapshot: nameSnap, ProductSKUSnapshot: skuSnap,
		SourcePage: in.SourcePage, EstimatedQty: in.EstimatedQty, Customization: in.Customization,
		Message: in.Message, Status: "new", IP: ip, UserAgent: ua,
	}
	if _, err := s.repo.CreateWithEvent(q); err != nil {
		return nil, apperr.Internal(err.Error())
	}

	// ⑦ 邮件通知异步投递（失败不影响询价数据）
	s.notifyAsync(q)
	return q, nil
}

// notifyAsync 异步邮件通知：成功 sent / 失败 failed / 未配置 skipped。
func (s *InquiryService) notifyAsync(q *model.Inquiry) {
	if !s.mail.Enabled() {
		_ = s.repo.SetEmailNotifyStatus(q.ID, "skipped", "SMTP not configured")
		return
	}
	go func() {
		defer func() {
			if rec := recover(); rec != nil {
				slog.Error("inquiry notify panic", "inquiry_id", q.ID, "panic", rec)
			}
		}()
		subject, text, htmlBody := email.InquiryNotification(q)
		if err := s.mail.Send(subject, text, htmlBody); err != nil {
			slog.Warn("inquiry notify mail failed", "inquiry_id", q.ID, "error", err.Error())
			_ = s.repo.SetEmailNotifyStatus(q.ID, "failed", err.Error())
		} else {
			_ = s.repo.SetEmailNotifyStatus(q.ID, "sent", "")
		}
	}()
}

// ---- 管理端 ----

// List 管理列表（搜索 + 时间/状态筛选 + 分页）。
func (s *InquiryService) List(q, status, from, to string, page, perPage int) ([]model.Inquiry, model.Pagination, error) {
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	if page < 1 {
		page = 1
	}
	items, total, err := s.repo.List(repository.ListFilters{Q: q, Status: status, From: from, To: to, Page: page, PerPage: perPage})
	if err != nil {
		return nil, model.Pagination{}, apperr.Internal(err.Error())
	}
	return items, model.Pagination{Page: page, PerPage: perPage, Total: total}, nil
}

// ListForExport CSV 导出（同筛选，无分页）。
func (s *InquiryService) ListForExport(q, status, from, to string) ([]model.Inquiry, error) {
	items, err := s.repo.ListAllForExport(repository.ListFilters{Q: q, Status: status, From: from, To: to})
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	return items, nil
}

// Get 详情（含事件历史）。
func (s *InquiryService) Get(id int64) (*model.Inquiry, []model.InquiryEvent, error) {
	q, err := s.repo.GetByID(id)
	if err != nil {
		return nil, nil, apperr.Internal(err.Error())
	}
	if q == nil {
		return nil, nil, apperr.NotFound("Inquiry not found")
	}
	events, err := s.repo.Events(id)
	if err != nil {
		return nil, nil, apperr.Internal(err.Error())
	}
	if events == nil {
		events = []model.InquiryEvent{}
	}
	return q, events, nil
}

var validInquiryStatus = map[string]bool{
	"new": true, "following": true, "replied": true, "completed": true, "spam": true,
}

// InquiryUpdateInput 状态/备注更新。
type InquiryUpdateInput struct {
	Status       *string `json:"status"`
	InternalNote *string `json:"internal_note"`
}

// Update 改状态/内部备注（写 inquiry_events）。
func (s *InquiryService) Update(id int64, in InquiryUpdateInput, adminID int64) (*model.Inquiry, error) {
	q, err := s.repo.GetByID(id)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	if q == nil {
		return nil, apperr.NotFound("Inquiry not found")
	}
	statusChanged := false
	noteChanged := false
	oldStatus := q.Status
	if in.Status != nil && *in.Status != q.Status {
		if !validInquiryStatus[*in.Status] {
			return nil, apperr.InvalidField("status", "must be new|following|replied|completed|spam")
		}
		q.Status = *in.Status
		statusChanged = true
		now := repository.Now()
		q.HandledBy = &adminID
		q.HandledAt = &now
	}
	if in.InternalNote != nil && *in.InternalNote != q.InternalNote {
		if charCount(*in.InternalNote) > 5000 {
			return nil, apperr.InvalidField("internal_note", "max 5000 chars")
		}
		q.InternalNote = *in.InternalNote
		noteChanged = true
	}
	if !statusChanged && !noteChanged {
		return q, nil
	}
	if err := s.repo.Update(q, oldStatus, &adminID, statusChanged, noteChanged); err != nil {
		return nil, apperr.Internal(err.Error())
	}
	return q, nil
}

// Delete 删除询价。
func (s *InquiryService) Delete(id int64) error {
	q, err := s.repo.GetByID(id)
	if err != nil {
		return apperr.Internal(err.Error())
	}
	if q == nil {
		return apperr.NotFound("Inquiry not found")
	}
	return s.repo.Delete(id)
}

// ResendNotify 重发邮件通知（同步发送，10s 超时）。
func (s *InquiryService) ResendNotify(id int64) (*model.Inquiry, error) {
	q, err := s.repo.GetByID(id)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	if q == nil {
		return nil, apperr.NotFound("Inquiry not found")
	}
	if !s.mail.Enabled() {
		return nil, apperr.Conflict("SMTP is not configured")
	}
	subject, text, htmlBody := email.InquiryNotification(q)
	if err := s.mail.Send(subject, text, htmlBody); err != nil {
		_ = s.repo.SetEmailNotifyStatus(id, "failed", err.Error())
		return nil, apperr.Internal("mail send failed: " + err.Error())
	}
	_ = s.repo.SetEmailNotifyStatus(id, "sent", "resent")
	return s.repo.GetByID(id)
}

// ExportCSV 生成 UTF-8 BOM CSV（Excel 友好）。
func (s *InquiryService) ExportCSV(q, status, from, to string) ([]byte, error) {
	items, err := s.ListForExport(q, status, from, to)
	if err != nil {
		return nil, err
	}
	b := &strings.Builder{}
	b.WriteString("\uFEFF") // UTF-8 BOM
	b.WriteString("id,created_at,name,company,email,whatsapp_phone,product_name,product_sku,estimated_qty,customization,message,status,source_page,ip\n")
	write := func(vals ...string) {
		esc := make([]string, len(vals))
		for i, v := range vals {
			// CSV 转义：含逗号/引号/换行时包裹并双写引号；前导 =+-@ 防公式注入
			if len(v) > 0 && (v[0] == '=' || v[0] == '+' || v[0] == '-' || v[0] == '@') {
				v = "'" + v
			}
			if strings.ContainsAny(v, ",\"\n\r") {
				v = "\"" + strings.ReplaceAll(v, "\"", "\"\"") + "\""
			}
			esc[i] = v
		}
		b.WriteString(strings.Join(esc, ",") + "\n")
	}
	for _, it := range items {
		write(
			fmt.Sprint(it.ID), it.CreatedAt, it.Name, it.Company, it.Email, it.WhatsAppPhone,
			it.ProductNameSnapshot, it.ProductSKUSnapshot, it.EstimatedQty, it.Customization,
			it.Message, it.Status, it.SourcePage, it.IP,
		)
	}
	return []byte(b.String()), nil
}
