package service

import "unicode/utf8"

// charCount 按字符（rune）计数；校验提示里的 "chars" 与前端 maxLength 语义一致。
func charCount(s string) int { return utf8.RuneCountInString(s) }

// truncateChars 按字符截断，避免把 UTF-8 多字节字符截成乱码。
func truncateChars(s string, max int) string {
	if max <= 0 {
		return ""
	}
	if utf8.RuneCountInString(s) <= max {
		return s
	}
	return string([]rune(s)[:max])
}

// truncateTail 保留末尾 max 个字符（用于文件名，尽量保留扩展名）。
func truncateTail(s string, max int) string {
	if max <= 0 {
		return ""
	}
	r := []rune(s)
	if len(r) <= max {
		return s
	}
	return string(r[len(r)-max:])
}
