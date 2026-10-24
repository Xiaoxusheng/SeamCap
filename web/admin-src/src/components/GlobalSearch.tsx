import { useEffect, useRef, useState } from 'react'
import { Input, Spin } from 'antd'
import type { InputRef } from 'antd'
import {
  AppstoreOutlined,
  ArrowRightOutlined,
  MailOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { get } from '../api/client'
import type { Inquiry, Product } from '../api/types'
import { InquiryStatusTag, ProductStatusTag } from './StatusTag'

interface Props {
  autoFocus?: boolean
  onNavigate?: () => void
  className?: string
}

// 顶栏搜索：真实查询产品与询价，明确标注搜索范围
export default function GlobalSearch({ autoFocus, onNavigate, className }: Props): JSX.Element {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<InputRef>(null)
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const q = term.trim()

  useEffect(() => {
    if (q.length < 2) {
      setProducts([])
      setInquiries([])
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    const timer = window.setTimeout(() => {
      void Promise.all([
        get<Product[]>(`/admin/products?q=${encodeURIComponent(q)}&per_page=5`),
        get<Inquiry[]>(`/admin/inquiries?q=${encodeURIComponent(q)}&per_page=4`),
      ])
        .then(([p, i]) => {
          if (!alive) return
          setProducts(p.data)
          setInquiries(i.data)
        })
        .catch(() => {
          if (!alive) return
          setProducts([])
          setInquiries([])
        })
        .finally(() => {
          if (alive) setLoading(false)
        })
    }, 280)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [q])

  useEffect(() => {
    const onPointerDown = (e: MouseEvent): void => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const go = (path: string): void => {
    setOpen(false)
    setTerm('')
    onNavigate?.()
    navigate(path)
  }

  const hasResults = products.length > 0 || inquiries.length > 0

  return (
    <div className={`sc-search${className ? ` ${className}` : ''}`} ref={containerRef}>
      <Input
        ref={inputRef}
        className="sc-search__input"
        prefix={<SearchOutlined className="sc-search__icon" />}
        placeholder="搜索产品、SKU 或客户询价"
        aria-label="搜索产品、SKU 或客户询价"
        allowClear
        autoFocus={autoFocus}
        value={term}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setTerm(e.target.value)
          setOpen(true)
        }}
        onPressEnter={() => {
          if (q) go(`/admin/products?q=${encodeURIComponent(q)}`)
        }}
        suffix={<kbd className="sc-search__kbd">Ctrl K</kbd>}
      />

      {open && (
        <div className="sc-search__panel" role="listbox" aria-label="搜索结果">
          <div className="sc-search__scope">搜索范围：产品名称 / SKU / 客户询价</div>
          {q.length < 2 ? (
            <div className="sc-search__empty">输入至少 2 个字符开始搜索</div>
          ) : loading ? (
            <div className="sc-search__loading">
              <Spin size="small" /> 正在检索…
            </div>
          ) : !hasResults ? (
            <div className="sc-search__empty">没有匹配的产品或询价</div>
          ) : (
            <>
              {products.length > 0 && (
                <div className="sc-search__group">
                  <div className="sc-search__group-title">
                    <AppstoreOutlined /> 产品
                  </div>
                  {products.map((p) => (
                    <button
                      type="button"
                      className="sc-search__result"
                      key={`p-${p.id}`}
                      onClick={() => go(`/admin/products/${p.id}/edit`)}
                      role="option"
                      aria-selected="false"
                    >
                      <span className="sc-search__result-main">
                        <span className="sc-search__result-title">{p.name}</span>
                        <span className="sc-search__result-meta">
                          {p.sku || '未设置 SKU'}
                          {p.category?.name ? ` · ${p.category.name}` : ''}
                        </span>
                      </span>
                      <ProductStatusTag status={p.status} />
                    </button>
                  ))}
                </div>
              )}

              {inquiries.length > 0 && (
                <div className="sc-search__group">
                  <div className="sc-search__group-title">
                    <MailOutlined /> 询价
                  </div>
                  {inquiries.map((inq) => (
                    <button
                      type="button"
                      className="sc-search__result"
                      key={`i-${inq.id}`}
                      onClick={() => go(`/admin/inquiries?inquiry=${inq.id}`)}
                      role="option"
                      aria-selected="false"
                    >
                      <span className="sc-search__result-main">
                        <span className="sc-search__result-title">{inq.name}</span>
                        <span className="sc-search__result-meta">
                          {[inq.company, inq.product_name_snapshot].filter(Boolean).join(' · ') ||
                            '未填写公司与产品'}
                        </span>
                      </span>
                      <InquiryStatusTag status={inq.status} />
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                className="sc-search__all"
                onClick={() => go(`/admin/products?q=${encodeURIComponent(q)}`)}
              >
                在产品管理中查看「{q}」 <ArrowRightOutlined />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
