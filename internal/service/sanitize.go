package service

import (
	"net/url"
	"strings"

	"golang.org/x/net/html"
	"golang.org/x/net/html/atom"
)

// 允许保留的标签（白名单）；不在白名单内的标签会被剥掉但保留子内容。
var allowedTags = map[string]bool{
	"p": true, "br": true, "hr": true,
	"strong": true, "b": true, "em": true, "i": true, "u": true, "s": true,
	"del": true, "ins": true, "mark": true, "small": true, "sub": true, "sup": true,
	"h1": true, "h2": true, "h3": true, "h4": true, "h5": true, "h6": true,
	"ul": true, "ol": true, "li": true, "dl": true, "dt": true, "dd": true,
	"blockquote": true, "pre": true, "code": true,
	"a": true, "img": true,
	"table": true, "thead": true, "tbody": true, "tfoot": true, "tr": true,
	"th": true, "td": true, "caption": true, "colgroup": true, "col": true,
	"div": true, "span": true, "figure": true, "figcaption": true,
	"video": true, "source": true, "audio": true,
}

// 连同内容一起丢弃的标签。
var dropTags = map[string]bool{
	"script": true, "style": true, "iframe": true, "object": true, "embed": true,
	"form": true, "input": true, "button": true, "select": true, "option": true, "textarea": true,
	"meta": true, "link": true, "base": true, "applet": true, "frame": true, "frameset": true,
	"svg": true, "math": true, "template": true, "noscript": true, "title": true, "head": true,
}

var globalAttrs = map[string]bool{"title": true, "class": true}

var tagAttrs = map[string]map[string]bool{
	"a":      {"href": true, "target": true, "rel": true},
	"img":    {"src": true, "alt": true, "width": true, "height": true, "loading": true},
	"video":  {"src": true, "poster": true, "controls": true, "width": true, "height": true, "preload": true, "muted": true, "loop": true},
	"audio":  {"src": true, "controls": true, "preload": true},
	"source": {"src": true, "type": true},
	"td":     {"colspan": true, "rowspan": true},
	"th":     {"colspan": true, "rowspan": true, "scope": true},
	"col":    {"span": true},
	"ol":     {"start": true},
}

// SanitizeHTML 富文本白名单过滤：基于 HTML 解析器重建 DOM，
// 只保留白名单标签/属性与安全 URL，避免正则黑名单被实体编码、标签拆分等绕过。
func SanitizeHTML(raw string) string {
	if strings.TrimSpace(raw) == "" {
		return ""
	}
	ctx := &html.Node{Type: html.ElementNode, Data: "div", DataAtom: atom.Div}
	nodes, err := html.ParseFragment(strings.NewReader(raw), ctx)
	if err != nil {
		return "" // 解析失败时 fail closed
	}
	root := &html.Node{Type: html.ElementNode, Data: "div", DataAtom: atom.Div}
	for _, n := range nodes {
		root.AppendChild(n)
	}
	sanitizeNode(root)

	var b strings.Builder
	for c := root.FirstChild; c != nil; c = c.NextSibling {
		if err := html.Render(&b, c); err != nil {
			return ""
		}
	}
	return b.String()
}

func sanitizeNode(parent *html.Node) {
	for c := parent.FirstChild; c != nil; {
		next := c.NextSibling
		switch c.Type {
		case html.CommentNode, html.DoctypeNode:
			parent.RemoveChild(c)
		case html.ElementNode:
			name := strings.ToLower(c.Data)
			switch {
			case dropTags[name]:
				parent.RemoveChild(c)
			case !allowedTags[name]:
				// 未知标签：保留已净化的子节点，剥掉标签本身
				sanitizeNode(c)
				for c.FirstChild != nil {
					child := c.FirstChild
					c.RemoveChild(child)
					parent.InsertBefore(child, c)
				}
				parent.RemoveChild(c)
			default:
				cleanAttrs(c, name)
				sanitizeNode(c)
			}
		}
		c = next
	}
}

func cleanAttrs(n *html.Node, tag string) {
	attrs := n.Attr[:0]
	for _, a := range n.Attr {
		key := strings.ToLower(a.Key)
		if a.Namespace != "" || strings.HasPrefix(key, "on") {
			continue
		}
		if !globalAttrs[key] && !(tagAttrs[tag] != nil && tagAttrs[tag][key]) {
			continue
		}
		switch key {
		case "href", "src", "poster":
			if !safeURL(a.Val) {
				continue
			}
		case "target":
			if a.Val != "_blank" && a.Val != "_self" {
				continue
			}
		}
		attrs = append(attrs, a)
	}
	n.Attr = attrs
	if tag == "a" && hasBlankTarget(n.Attr) {
		filtered := n.Attr[:0]
		for _, a := range n.Attr {
			if a.Key != "rel" {
				filtered = append(filtered, a)
			}
		}
		n.Attr = append(filtered, html.Attribute{Key: "rel", Val: "noopener noreferrer"})
	}
}

func hasBlankTarget(attrs []html.Attribute) bool {
	for _, a := range attrs {
		if a.Key == "target" && a.Val == "_blank" {
			return true
		}
	}
	return false
}

// safeURL 只放行 http/https/mailto/tel 与相对地址；拒绝 javascript/data 等协议与控制字符。
func safeURL(raw string) bool {
	v := strings.TrimSpace(raw)
	if v == "" {
		return false
	}
	for _, r := range v {
		if r < 0x20 || r == 0x7f {
			return false
		}
	}
	u, err := url.Parse(v)
	if err != nil {
		return false
	}
	switch strings.ToLower(u.Scheme) {
	case "", "http", "https", "mailto", "tel":
		return true
	default:
		return false
	}
}
