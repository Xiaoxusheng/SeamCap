import dayjs from 'dayjs'
import type { Media, Pagination } from './types'

// 统一请求封装：自动带 CSRF、解包 {data,pagination}、统一错误、401 全局处理

export class ApiError extends Error {
  status: number
  code: string
  fields?: Record<string, string>

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

let csrfToken = ''
let unauthorizedHandler: (() => void) | null = null

export function setCSRFToken(token: string): void {
  csrfToken = token
}

export function setUnauthorizedHandler(fn: () => void): void {
  unauthorizedHandler = fn
}

const WRITE_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH'])

interface RequestOptions extends Omit<RequestInit, 'body'> {
  json?: unknown
  body?: BodyInit
}

export interface Result<T> {
  data: T
  pagination?: Pagination
}

export async function request<T = unknown>(path: string, opts: RequestOptions = {}): Promise<Result<T>> {
  const { json, headers, ...rest } = opts
  const h: Record<string, string> = {}
  if (headers) Object.assign(h, headers)
  let body: BodyInit | undefined
  if (json !== undefined) {
    h['Content-Type'] = 'application/json'
    body = JSON.stringify(json)
  } else if (opts.body !== undefined) {
    body = opts.body
  }
  if (WRITE_METHODS.has((opts.method ?? 'GET').toUpperCase())) {
    h['X-CSRF-Token'] = csrfToken
  }
  const res = await fetch('/api/v1' + path, { ...rest, method: opts.method ?? 'GET', headers: h, body })
  if (res.status === 401 && unauthorizedHandler) {
    unauthorizedHandler()
  }
  let payload: { data?: unknown; pagination?: Pagination; error?: { code?: string; message?: string; fields?: Record<string, string> } } = {}
  try {
    payload = await res.json()
  } catch {
    // 非 JSON 响应（理论上不出现）
  }
  if (!res.ok) {
    const e = payload?.error ?? {}
    throw new ApiError(res.status, e.code ?? 'UNKNOWN', e.message ?? `HTTP ${res.status}`, e.fields)
  }
  return { data: payload?.data as T, pagination: payload?.pagination }
}

// ---- 便捷方法 ----

export function get<T>(path: string): Promise<Result<T>> {
  return request<T>(path)
}

export function post<T>(path: string, json?: unknown): Promise<Result<T>> {
  return request<T>(path, { method: 'POST', json })
}

export function put<T>(path: string, json?: unknown): Promise<Result<T>> {
  return request<T>(path, { method: 'PUT', json })
}

export function del<T>(path: string): Promise<Result<T>> {
  return request<T>(path, { method: 'DELETE' })
}

// ---- 媒体缓存（MediaIDField 回显用） ----

const mediaCache = new Map<number, Media>()

export function cacheMedia(items: Media[]): void {
  for (const m of items) mediaCache.set(m.id, m)
}

export async function fetchMedia(id: number): Promise<Media | null> {
  const hit = mediaCache.get(id)
  if (hit) return hit
  try {
    const { data } = await get<Media>(`/admin/media/${id}`)
    if (data) mediaCache.set(data.id, data)
    return data
  } catch {
    return null
  }
}

export function cachedMedia(id: number): Media | undefined {
  return mediaCache.get(id)
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function fmtTime(s: string | null | undefined): string {
  if (!s) return '—'
  const d = dayjs(s)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm') : '—'
}

export function mediaFullURL(url: string): string {
  return url.startsWith('http') ? url : location.origin + url
}
