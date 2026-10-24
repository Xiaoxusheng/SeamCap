// Package handler HTTP 层公共辅助：参数绑定与响应，不含业务逻辑。
package handler

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"reflect"

	"seamcap/internal/apperr"
	"seamcap/internal/model"
)

const maxJSONBody = 1 << 20 // 1MB

// JSON 输出统一结构。
func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// Data 成功响应 {"data": ...}；nil 切片统一输出为 []。
func Data(w http.ResponseWriter, v any) {
	JSON(w, http.StatusOK, map[string]any{"data": nonNilSlice(v)})
}

// Created 201 响应。
func Created(w http.ResponseWriter, v any) { JSON(w, http.StatusCreated, map[string]any{"data": v}) }

// List 列表响应 {"data": [...], "pagination": {...}}。
func List(w http.ResponseWriter, items any, p model.Pagination) {
	JSON(w, http.StatusOK, map[string]any{"data": nonNilSlice(items), "pagination": p})
}

// nonNilSlice 避免空列表被序列化成 null。
func nonNilSlice(v any) any {
	rv := reflect.ValueOf(v)
	if rv.IsValid() && rv.Kind() == reflect.Slice && rv.IsNil() {
		return []any{}
	}
	return v
}

// Error 业务错误 → HTTP 状态码 + 统一 JSON；未知错误一律 500（不暴露堆栈）。
func Error(w http.ResponseWriter, err error) {
	if ae, ok := apperr.As(err); ok {
		if ae.Code == apperr.CodeInternal {
			slog.Error("internal error", "error", ae.Error())
		}
		status := apperr.HTTPStatus(ae.Code)
		body := map[string]any{"code": ae.Code, "message": ae.Message}
		if ae.Fields != nil {
			body["fields"] = ae.Fields
		}
		JSON(w, status, map[string]any{"error": body})
		return
	}
	slog.Error("internal error", "error", err.Error())
	JSON(w, http.StatusInternalServerError, map[string]any{"error": map[string]any{
		"code": apperr.CodeInternal, "message": "Internal server error",
	}})
}

// Decode 解析 JSON 请求体（≤1MB），超限返回 413。
func Decode(r *http.Request, dst any) error {
	body := http.MaxBytesReader(nil, r.Body, maxJSONBody)
	dec := json.NewDecoder(body)
	if err := dec.Decode(dst); err != nil {
		var mbe *http.MaxBytesError
		if errors.As(err, &mbe) {
			return apperr.TooLarge("Request body too large")
		}
		return apperr.InvalidField("body", "invalid JSON: "+err.Error())
	}
	return nil
}

// QueryInt64 解析 int64 查询参数，默认 def。
func QueryInt64(r *http.Request, key string, def int64) int64 {
	v := r.URL.Query().Get(key)
	if v == "" {
		return def
	}
	var n int64
	neg := false
	for i, c := range v {
		if i == 0 && c == '-' {
			neg = true
			continue
		}
		if c < '0' || c > '9' {
			return def
		}
		n = n*10 + int64(c-'0')
	}
	if neg {
		n = -n
	}
	return n
}

// QueryInt 解析 int 查询参数，默认 def。
func QueryInt(r *http.Request, key string, def int) int {
	return int(QueryInt64(r, key, int64(def)))
}
