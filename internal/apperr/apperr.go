// Package apperr 定义统一的业务错误类型。
// service 层返回 *apperr.Error，handler 层映射为 HTTP 状态码 + 统一 JSON 结构。
package apperr

import "fmt"

// 错误码与 HTTP 状态码的映射见 HTTPStatus()。
const (
	CodeValidation   = "VALIDATION_ERROR"   // 400
	CodeUnauthorized = "UNAUTHORIZED"       // 401
	CodeForbidden    = "FORBIDDEN"          // 403
	CodeNotFound     = "NOT_FOUND"          // 404
	CodeConflict     = "CONFLICT"           // 409
	CodeTooLarge     = "PAYLOAD_TOO_LARGE"  // 413
	CodeRateLimited  = "RATE_LIMITED"       // 429
	CodeInternal     = "INTERNAL"           // 500
)

// Error 是贯穿 service → handler 的统一错误。
type Error struct {
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Fields  map[string]string `json:"fields,omitempty"`
	// Detail 仅供日志/内部使用，不会输出给客户端。
	Detail string `json:"-"`
}

func (e *Error) Error() string {
	if e.Detail != "" {
		return fmt.Sprintf("%s: %s (%s)", e.Code, e.Message, e.Detail)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func New(code, message string) *Error { return &Error{Code: code, Message: message} }

func WithDetail(code, message, detail string) *Error {
	return &Error{Code: code, Message: message, Detail: detail}
}

// Invalid 构造字段级校验错误。
func Invalid(fields map[string]string) *Error {
	return &Error{Code: CodeValidation, Message: "Validation failed", Fields: fields}
}

func InvalidField(field, msg string) *Error {
	return &Error{Code: CodeValidation, Message: "Validation failed", Fields: map[string]string{field: msg}}
}

func Unauthorized(msg string) *Error {
	if msg == "" {
		msg = "Authentication required"
	}
	return &Error{Code: CodeUnauthorized, Message: msg}
}

func Forbidden(msg string) *Error {
	if msg == "" {
		msg = "Forbidden"
	}
	return &Error{Code: CodeForbidden, Message: msg}
}

func NotFound(msg string) *Error {
	if msg == "" {
		msg = "Resource not found"
	}
	return &Error{Code: CodeNotFound, Message: msg}
}

func Conflict(msg string) *Error { return &Error{Code: CodeConflict, Message: msg} }

func TooLarge(msg string) *Error { return &Error{Code: CodeTooLarge, Message: msg} }

func RateLimited(msg string) *Error {
	if msg == "" {
		msg = "Too many requests, please try again later"
	}
	return &Error{Code: CodeRateLimited, Message: msg}
}

func Internal(msg string) *Error {
	return &Error{Code: CodeInternal, Message: "Internal server error", Detail: msg}
}

// HTTPStatus 将错误码映射为 HTTP 状态码。
func HTTPStatus(code string) int {
	switch code {
	case CodeValidation:
		return 400
	case CodeUnauthorized:
		return 401
	case CodeForbidden:
		return 403
	case CodeNotFound:
		return 404
	case CodeConflict:
		return 409
	case CodeTooLarge:
		return 413
	case CodeRateLimited:
		return 429
	default:
		return 500
	}
}

// As 尝试将 err 断言为 *Error。
func As(err error) (*Error, bool) {
	e, ok := err.(*Error)
	return e, ok
}
