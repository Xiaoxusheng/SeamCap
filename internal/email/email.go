// Package email SMTP 邮件通知（标准库 net/smtp 封装）。
// 凭据仅存环境变量；发送失败不影响询价落库（由 service 层异步调用）。
package email

import (
	"crypto/tls"
	"fmt"
	"html"
	"net"
	"net/mail"
	"net/smtp"
	"strconv"
	"strings"
	"time"

	"seamcap/internal/model"
)

type Config struct {
	Host     string
	Port     int
	User     string
	Pass     string
	FromName string
	NotifyTo string
	TLSMode  string // ssl | starttls | none
}

type Sender struct {
	cfg     Config
	timeout time.Duration
}

func NewSender(cfg Config) *Sender {
	return &Sender{cfg: cfg, timeout: 10 * time.Second}
}

// Enabled 判断邮件通知是否已配置。
func (s *Sender) Enabled() bool {
	return s.cfg.Host != "" && s.cfg.NotifyTo != ""
}

// addressList 解析收件人地址。
func addressList(to string) ([]string, error) {
	addrs, err := mail.ParseAddressList(to)
	if err != nil {
		return nil, err
	}
	out := make([]string, 0, len(addrs))
	for _, a := range addrs {
		out = append(out, a.Address)
	}
	return out, nil
}

func (s *Sender) fromAddress() mail.Address {
	return mail.Address{Name: s.cfg.FromName, Address: s.cfg.User}
}

// singleLine 去除邮件头中的换行/控制字符，防止头部注入。
func singleLine(s string) string {
	return strings.Map(func(r rune) rune {
		if r == '\r' || r == '\n' || r == 0 {
			return ' '
		}
		return r
	}, s)
}

// sendRaw 建立连接并发送（按 TLS 模式）。
func (s *Sender) sendRaw(to []string, subject, textBody, htmlBody string) error {
	from := s.fromAddress()
	addr := net.JoinHostPort(s.cfg.Host, strconv.Itoa(s.cfg.Port))

	headers := map[string]string{
		"From":         from.String(),
		"To":           strings.Join(to, ", "),
		"Subject":      subject,
		"MIME-Version": "1.0",
	}
	msg := &strings.Builder{}
	boundary := "seamcap-boundary-7f3a"
	headers["Content-Type"] = fmt.Sprintf("multipart/alternative; boundary=%q", boundary)
	for k, v := range headers {
		msg.WriteString(k + ": " + singleLine(v) + "\r\n")
	}
	msg.WriteString("\r\n")
	msg.WriteString("--" + boundary + "\r\n")
	msg.WriteString("Content-Type: text/plain; charset=UTF-8\r\n\r\n")
	msg.WriteString(textBody + "\r\n")
	msg.WriteString("--" + boundary + "\r\n")
	msg.WriteString("Content-Type: text/html; charset=UTF-8\r\n\r\n")
	msg.WriteString(htmlBody + "\r\n")
	msg.WriteString("--" + boundary + "--\r\n")

	auth := smtp.PlainAuth("", s.cfg.User, s.cfg.Pass, s.cfg.Host)

	switch s.cfg.TLSMode {
	case "ssl":
		conn, err := tls.DialWithDialer(&net.Dialer{Timeout: s.timeout}, "tcp", addr,
			&tls.Config{ServerName: s.cfg.Host})
		if err != nil {
			return fmt.Errorf("smtp ssl dial: %w", err)
		}
		defer conn.Close()
		c, err := smtp.NewClient(conn, s.cfg.Host)
		if err != nil {
			return fmt.Errorf("smtp client: %w", err)
		}
		defer c.Close()
		if ok, _ := c.Extension("AUTH"); ok && s.cfg.User != "" {
			if err := c.Auth(auth); err != nil {
				return fmt.Errorf("smtp auth: %w", err)
			}
		}
		return sendViaClient(c, from.Address, to, msg.String())
	case "starttls":
		conn, err := net.DialTimeout("tcp", addr, s.timeout)
		if err != nil {
			return fmt.Errorf("smtp dial: %w", err)
		}
		c, err := smtp.NewClient(conn, s.cfg.Host)
		if err != nil {
			conn.Close()
			return fmt.Errorf("smtp client: %w", err)
		}
		defer c.Close()
		if ok, _ := c.Extension("STARTTLS"); ok {
			if err := c.StartTLS(&tls.Config{ServerName: s.cfg.Host}); err != nil {
				return fmt.Errorf("smtp starttls: %w", err)
			}
		}
		if ok, _ := c.Extension("AUTH"); ok && s.cfg.User != "" {
			if err := c.Auth(auth); err != nil {
				return fmt.Errorf("smtp auth: %w", err)
			}
		}
		return sendViaClient(c, from.Address, to, msg.String())
	default: // none：仅内网调试
		conn, err := net.DialTimeout("tcp", addr, s.timeout)
		if err != nil {
			return fmt.Errorf("smtp dial: %w", err)
		}
		c, err := smtp.NewClient(conn, s.cfg.Host)
		if err != nil {
			conn.Close()
			return fmt.Errorf("smtp client: %w", err)
		}
		defer c.Close()
		return sendViaClient(c, from.Address, to, msg.String())
	}
}

func sendViaClient(c *smtp.Client, from string, to []string, body string) error {
	if err := c.Mail(from); err != nil {
		return fmt.Errorf("smtp mail: %w", err)
	}
	for _, t := range to {
		if err := c.Rcpt(t); err != nil {
			return fmt.Errorf("smtp rcpt: %w", err)
		}
	}
	w, err := c.Data()
	if err != nil {
		return fmt.Errorf("smtp data: %w", err)
	}
	if _, err := w.Write([]byte(body)); err != nil {
		return fmt.Errorf("smtp write: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("smtp data close: %w", err)
	}
	return c.Quit()
}

// Send 带超时发送。
func (s *Sender) Send(subject, textBody, htmlBody string) error {
	to, err := addressList(s.cfg.NotifyTo)
	if err != nil {
		return fmt.Errorf("invalid NOTIFY_EMAIL: %w", err)
	}
	done := make(chan error, 1)
	go func() {
		done <- s.sendRaw(to, subject, textBody, htmlBody)
	}()
	select {
	case err := <-done:
		return err
	case <-time.After(s.timeout + 2*time.Second):
		return fmt.Errorf("smtp send timeout")
	}
}

// SendTestMail 配置自检。
func (s *Sender) SendTestMail() error {
	now := time.Now().UTC().Format("2006-01-02 15:04:05 MST")
	subject := "[SeamCap] SMTP test mail"
	text := "This is a test mail from SeamCap backend.\nTime: " + now + "\nIf you received this, SMTP is configured correctly."
	body := "<p>This is a <strong>test mail</strong> from SeamCap backend.</p><p>Time: " + now + "</p><p>If you received this, SMTP is configured correctly.</p>"
	return s.Send(subject, text, body)
}

// InquiryNotification 新询价通知邮件（纯文本 + 简单 HTML 双部分）。
func InquiryNotification(q *model.Inquiry) (subject, text, htmlBody string) {
	subject = fmt.Sprintf("[SeamCap] New inquiry #%d from %s", q.ID, singleLine(q.Name))
	b := &strings.Builder{}
	row := func(label, value string) {
		if value == "" {
			return
		}
		fmt.Fprintf(b, "%s: %s\n", label, value)
	}
	row("Name", q.Name)
	row("Company", q.Company)
	row("Email", q.Email)
	row("WhatsApp/Phone", q.WhatsAppPhone)
	row("Product", strings.TrimSpace(q.ProductNameSnapshot+" "+q.ProductSKUSnapshot))
	row("Estimated Qty", q.EstimatedQty)
	row("Customization", q.Customization)
	row("Source Page", q.SourcePage)
	row("Time (UTC)", q.CreatedAt)
	b.WriteString("\nMessage:\n" + q.Message + "\n")
	text = b.String()

	h := &strings.Builder{}
	h.WriteString("<h2 style='margin:0 0 12px'>New Inquiry #" + strconv.FormatInt(q.ID, 10) + "</h2><table cellpadding='6' style='border-collapse:collapse'>")
	hrow := func(label, value string) {
		if value == "" {
			return
		}
		fmt.Fprintf(h, "<tr><td style='color:#64748b;white-space:nowrap'>%s</td><td><strong>%s</strong></td></tr>",
			html.EscapeString(label), html.EscapeString(value))
	}
	hrow("Name", q.Name)
	hrow("Company", q.Company)
	hrow("Email", q.Email)
	hrow("WhatsApp/Phone", q.WhatsAppPhone)
	hrow("Product", strings.TrimSpace(q.ProductNameSnapshot+" "+q.ProductSKUSnapshot))
	hrow("Estimated Qty", q.EstimatedQty)
	hrow("Customization", q.Customization)
	hrow("Source Page", q.SourcePage)
	hrow("Time (UTC)", q.CreatedAt)
	h.WriteString("</table><h3>Message</h3><pre style='white-space:pre-wrap;font-family:inherit'>")
	h.WriteString(html.EscapeString(q.Message))
	h.WriteString("</pre>")
	htmlBody = h.String()
	return subject, text, htmlBody
}
