// Package seo SEO 模块：sitemap.xml / robots.txt 动态生成（仅 published 内容）。
package seo

import (
	"strings"
)

// Entry sitemap 条目。
type Entry struct {
	Loc     string // 相对路径（不含域名）
	LastMod string // RFC3339 或空
}

// SitemapXML 生成 sitemap.xml 内容。
func SitemapXML(baseURL string, entries []Entry) []byte {
	base := strings.TrimRight(baseURL, "/")
	b := &strings.Builder{}
	b.WriteString(`<?xml version="1.0" encoding="UTF-8"?>` + "\n")
	b.WriteString(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` + "\n")
	for _, e := range entries {
		loc := base + e.Loc
		if !strings.HasPrefix(e.Loc, "/") {
			loc = base + "/" + e.Loc
		}
		b.WriteString("  <url>\n    <loc>" + xmlEscape(loc) + "</loc>\n")
		if e.LastMod != "" {
			b.WriteString("    <lastmod>" + xmlEscape(e.LastMod) + "</lastmod>\n")
		}
		b.WriteString("  </url>\n")
	}
	b.WriteString("</urlset>\n")
	return []byte(b.String())
}

func xmlEscape(s string) string {
	r := strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", "'", "&#39;", `"`, "&#34;")
	return r.Replace(s)
}

// RobotsTXT 生成 robots.txt：允许抓取前台，Disallow /admin/。
func RobotsTXT(baseURL string) []byte {
	b := &strings.Builder{}
	b.WriteString("User-agent: *\n")
	b.WriteString("Allow: /\n")
	b.WriteString("Disallow: /admin/\n")
	b.WriteString("Disallow: /api/\n")
	if baseURL != "" {
		b.WriteString("\nSitemap: " + strings.TrimRight(baseURL, "/") + "/sitemap.xml\n")
	}
	return []byte(b.String())
}

// WhatsAppTextInquiry 构建询价 WhatsApp 预填文本（含产品链接时使用 BASE_URL）。
func WhatsAppTextInquiry(productName, productURL string) string {
	t := "Hello, I'm interested in "
	if productName != "" {
		t += productName
	} else {
		t += "your products"
	}
	if productURL != "" {
		t += " " + productURL
	}
	t += ". Could you share a quotation?"
	return t
}
