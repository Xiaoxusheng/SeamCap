package service

import (
	"strings"
	"testing"

	"seamcap/internal/apperr"
	"seamcap/internal/repository"
)

func validInquiryInput() InquiryInput {
	return InquiryInput{
		Name:    "John Buyer",
		Email:   "john@buyer.com",
		Message: "Please quote 5000 pcs of the plain color caps.",
	}
}

func TestSubmitInquiryValidation(t *testing.T) {
	env := newSvcEnv(t)

	// 缺 name
	in := validInquiryInput()
	in.Name = ""
	if _, err := env.Inqs.Submit(in, "1.1.1.1", "ua"); !isValidation(err, "name") {
		t.Errorf("missing name should fail: %v", err)
	}
	// 非法 email
	in = validInquiryInput()
	in.Email = "not-an-email"
	if _, err := env.Inqs.Submit(in, "1.1.1.1", "ua"); !isValidation(err, "email") {
		t.Errorf("bad email should fail: %v", err)
	}
	// message 太短
	in = validInquiryInput()
	in.Message = "short"
	if _, err := env.Inqs.Submit(in, "1.1.1.1", "ua"); !isValidation(err, "message") {
		t.Errorf("short message should fail: %v", err)
	}
	// 非法电话
	in = validInquiryInput()
	in.WhatsAppPhone = "call me maybe"
	if _, err := env.Inqs.Submit(in, "1.1.1.1", "ua"); !isValidation(err, "whatsapp_phone") {
		t.Errorf("bad phone should fail: %v", err)
	}
}

func isValidation(err error, field string) bool {
	ae, ok := apperr.As(err)
	return ok && ae.Code == apperr.CodeValidation && ae.Fields[field] != ""
}

func TestSubmitHoneypotSilentlyDrops(t *testing.T) {
	env := newSvcEnv(t)
	in := validInquiryInput()
	in.Website = "http://spam.example" // honeypot 命中
	q, err := env.Inqs.Submit(in, "2.2.2.2", "ua")
	if err != nil {
		t.Fatalf("honeypot should fake success, got %v", err)
	}
	if q.ID != 0 {
		t.Errorf("fake success should not have real id, got %d", q.ID)
	}
	_, total, err := env.Repos.Inq.List(repository.ListFilters{Page: 1, PerPage: 10})
	if err != nil {
		t.Fatal(err)
	}
	if total != 0 {
		t.Errorf("honeypot submission must not be persisted, got %d rows", total)
	}
}

func TestSubmitInquiryRateLimit(t *testing.T) {
	env := newSvcEnv(t) // RateLimitInquiryPerHour=2
	for i := 0; i < 2; i++ {
		if _, err := env.Inqs.Submit(validInquiryInput(), "3.3.3.3", "ua"); err != nil {
			t.Fatalf("submit %d: %v", i+1, err)
		}
	}
	_, err := env.Inqs.Submit(validInquiryInput(), "3.3.3.3", "ua")
	ae, ok := apperr.As(err)
	if !ok || ae.Code != apperr.CodeRateLimited {
		t.Errorf("3rd submit should be rate limited, got %v", err)
	}
	// 其他 IP 不受影响
	if _, err := env.Inqs.Submit(validInquiryInput(), "4.4.4.4", "ua"); err != nil {
		t.Errorf("other IP should pass: %v", err)
	}
}

func TestInquiryProductSnapshot(t *testing.T) {
	env := newSvcEnv(t)
	// 已发布产品
	pub, err := env.Prods.Create(ProductInput{Name: "Solid Color Cap", SKU: "LG260008", Status: "published"})
	if err != nil {
		t.Fatal(err)
	}
	// 草稿产品
	draft, err := env.Prods.Create(ProductInput{Name: "Draft Cap", SKU: "LG260010", Status: "draft"})
	if err != nil {
		t.Fatal(err)
	}

	id := pub.ID
	in := validInquiryInput()
	in.ProductID = &id
	q, err := env.Inqs.Submit(in, "5.5.5.5", "ua")
	if err != nil {
		t.Fatal(err)
	}
	if q.ProductNameSnapshot != "Solid Color Cap" || q.ProductSKUSnapshot != "LG260008" {
		t.Errorf("snapshot wrong: %+v", q)
	}

	did := draft.ID
	in2 := validInquiryInput()
	in2.ProductID = &did
	q2, err := env.Inqs.Submit(in2, "5.5.5.5", "ua")
	if err != nil {
		t.Fatal(err)
	}
	if q2.ProductID != nil {
		t.Errorf("draft product_id should be nulled, got %v", *q2.ProductID)
	}
	if q2.ProductNameSnapshot != "" {
		t.Errorf("draft product should not snapshot name, got %q", q2.ProductNameSnapshot)
	}
}

func TestInquirySnapshotSurvivesProductDelete(t *testing.T) {
	env := newSvcEnv(t)
	p, _ := env.Prods.Create(ProductInput{Name: "Camo Cap", SKU: "LG260012", Status: "published"})
	id := p.ID
	in := validInquiryInput()
	in.ProductID = &id
	q, err := env.Inqs.Submit(in, "6.6.6.6", "ua")
	if err != nil {
		t.Fatal(err)
	}
	if err := env.Prods.Delete(p.ID); err != nil {
		t.Fatalf("delete product: %v", err)
	}
	got, _, err := env.Inqs.Get(q.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.ProductNameSnapshot != "Camo Cap" || got.ProductSKUSnapshot != "LG260012" {
		t.Errorf("snapshot must survive product deletion: %+v", got)
	}
	if got.ProductID != nil {
		t.Errorf("product_id should be nulled by FK, got %v", *got.ProductID)
	}
}

func TestInquiryStatusFlowAndEvents(t *testing.T) {
	env := newSvcEnv(t).CreateAdmin(t, "admin", "password1234")
	q, err := env.Inqs.Submit(validInquiryInput(), "7.7.7.7", "ua")
	if err != nil {
		t.Fatal(err)
	}
	newStatus := "replied"
	upd, err := env.Inqs.Update(q.ID, InquiryUpdateInput{Status: &newStatus}, 1)
	if err != nil {
		t.Fatal(err)
	}
	if upd.Status != "replied" || upd.HandledBy == nil {
		t.Errorf("status not applied: %+v", upd)
	}
	note := "called customer"
	if _, err := env.Inqs.Update(q.ID, InquiryUpdateInput{InternalNote: &note}, 1); err != nil {
		t.Fatal(err)
	}
	_, events, err := env.Inqs.Get(q.ID)
	if err != nil {
		t.Fatal(err)
	}
	var types []string
	for _, e := range events {
		types = append(types, e.EventType)
	}
	joined := strings.Join(types, ",")
	if !strings.Contains(joined, "created") || !strings.Contains(joined, "status_changed") || !strings.Contains(joined, "note") {
		t.Errorf("events missing: %v", types)
	}
	// 非法状态
	bad := "nope"
	if _, err := env.Inqs.Update(q.ID, InquiryUpdateInput{Status: &bad}, 1); !isValidation(err, "status") {
		t.Errorf("invalid status should fail: %v", err)
	}
}

func TestExportCSVHasBOM(t *testing.T) {
	env := newSvcEnv(t)
	if _, err := env.Inqs.Submit(validInquiryInput(), "8.8.8.8", "ua"); err != nil {
		t.Fatal(err)
	}
	data, err := env.Inqs.ExportCSV("", "", "", "")
	if err != nil {
		t.Fatal(err)
	}
	if data[0] != 0xEF || data[1] != 0xBB || data[2] != 0xBF {
		t.Error("CSV must start with UTF-8 BOM")
	}
	if !strings.Contains(string(data), "john@buyer.com") {
		t.Error("CSV should contain submitted email")
	}
}
