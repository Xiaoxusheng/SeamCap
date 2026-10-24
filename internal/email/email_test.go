package email

import (
	"strings"
	"testing"

	"seamcap/internal/model"
)

func TestInquiryNotificationStripsHeaderInjection(t *testing.T) {
	q := &model.Inquiry{
		ID:      7,
		Name:    "Eve\r\nBcc: victim@example.com",
		Email:   "eve@example.com",
		Message: "hello\r\nContent-Type: text/html",
	}
	subject, text, htmlBody := InquiryNotification(q)
	if strings.ContainsAny(subject, "\r\n") {
		t.Errorf("subject contains CR/LF: %q", subject)
	}
	if !strings.Contains(subject, "Eve") {
		t.Errorf("subject lost the sender name: %q", subject)
	}
	if !strings.Contains(text, "Eve") || !strings.Contains(htmlBody, "Eve") {
		t.Error("body should still contain the sanitized name")
	}
}
