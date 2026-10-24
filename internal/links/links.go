// Package links 联系链接工具：WhatsApp 号码规范化与 wa.me 链接构建。
package links

import (
	"net/url"
	"strings"
)

// NormalizeWhatsApp 规范化 WhatsApp 号码：去除 +、空格、连接符与括号，仅保留数字。
// 输入应含国家码，如 "+86 133 8861 4562" → "8613388614562"。
func NormalizeWhatsApp(raw string) string {
	var b strings.Builder
	for _, r := range raw {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// WhatsAppLink 构建 https://wa.me/<digits>?text=... 链接；号码为空返回空串。
func WhatsAppLink(raw, text string) string {
	digits := NormalizeWhatsApp(raw)
	if digits == "" {
		return ""
	}
	link := "https://wa.me/" + digits
	if text != "" {
		link += "?text=" + url.QueryEscape(text)
	}
	return link
}
