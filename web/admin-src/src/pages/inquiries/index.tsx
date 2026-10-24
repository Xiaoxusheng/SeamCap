import { useCallback, useEffect, useRef, useState } from 'react'
import {
  App,
  Button,
  DatePicker,
  Input,
  Pagination,
  Popconfirm,
  Select,
  Skeleton,
  Tooltip,
} from 'antd'
import {
  ArrowLeftOutlined,
  ClearOutlined,
  DownloadOutlined,
  InboxOutlined,
  MailOutlined,
  RedoOutlined,
  ReloadOutlined,
  TagOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useSearchParams } from 'react-router-dom'
import { del, fmtTime, get, post, put } from '../../api/client'
import type { Inquiry, InquiryEvent, InquiryStatus } from '../../api/types'
import { InquiryStatusTag, NotifyStatusTag } from '../../components/StatusTag'
import PageHeader from '../../components/PageHeader'
import PageError from '../../components/PageError'
import EmptyState from '../../components/EmptyState'

const STATUS_LABEL: Record<string, string> = {
  new: '新询价',
  following: '跟进中',
  replied: '已回复',
  completed: '已完成',
  spam: '垃圾',
  '': '—',
}

const STATUS_OPTIONS: { value: InquiryStatus; label: string }[] = [
  { value: 'new', label: '新询价' },
  { value: 'following', label: '跟进中' },
  { value: 'replied', label: '已回复' },
  { value: 'completed', label: '已完成' },
  { value: 'spam', label: '垃圾' },
]

// 状态筛选 chips：全部 + 各状态（替代下拉框，一眼可扫）
const STATUS_CHIPS: { value?: InquiryStatus; label: string }[] = [
  { label: '全部' },
  ...STATUS_OPTIONS,
]

function parseStatus(v: string | null): InquiryStatus | undefined {
  return v === 'new' || v === 'following' || v === 'replied' || v === 'completed' || v === 'spam'
    ? v
    : undefined
}

function statusLabel(s: string): string {
  return STATUS_LABEL[s] ?? s ?? '—'
}

function shortTime(s: string): string {
  const d = dayjs(s)
  return d.isValid() ? d.format('MM-DD HH:mm') : '—'
}

// 头像缩写：英文名取首字母，中文名取前两字
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase()
}

function eventLabel(e: InquiryEvent): string {
  switch (e.event_type) {
    case 'created':
      return '客户提交询价'
    case 'status_changed':
      return `状态：${statusLabel(e.from_status)} → ${statusLabel(e.to_status)}`
    case 'note':
      return '更新内部备注'
    case 'notify':
      return '邮件通知'
    default:
      return e.event_type
  }
}

// 询价工作台：工具栏 + 列表 / 详情双栏一体化，移动端列表 / 详情切换
export default function Inquiries(): JSX.Element {
  const { message } = App.useApp()
  const [searchParams, setSearchParams] = useSearchParams()

  const [keyword, setKeyword] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<InquiryStatus | undefined>(() =>
    parseStatus(searchParams.get('status')),
  )
  const [range, setRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [list, setList] = useState<Inquiry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [detail, setDetail] = useState<Inquiry | null>(null)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [events, setEvents] = useState<InquiryEvent[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [resending, setResending] = useState(false)
  const detailReqRef = useRef(0)
  const autoOpenedRef = useRef<string | null>(null)

  useEffect(() => {
    setStatus(parseStatus(searchParams.get('status')))
  }, [searchParams])

  const buildParams = useCallback((): string => {
    const params = new URLSearchParams({ page: String(page), per_page: String(pageSize) })
    if (q) params.set('q', q)
    if (status) params.set('status', status)
    if (range && range[0]) params.set('from', range[0].startOf('day').toISOString())
    if (range && range[1]) params.set('to', range[1].endOf('day').toISOString())
    return params.toString()
  }, [page, pageSize, q, status, range])

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const { data, pagination } = await get<Inquiry[]>('/admin/inquiries?' + buildParams())
      setList(data)
      setTotal(pagination?.total ?? 0)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  useEffect(() => {
    void load()
  }, [load])

  const openDetailById = useCallback(async (id: number, seed?: Inquiry): Promise<void> => {
    const req = ++detailReqRef.current
    setDetailId(id)
    setDetail(seed ?? null)
    setEvents([])
    setNote(seed?.internal_note ?? '')
    setDetailError('')
    setDetailLoading(true)
    try {
      const { data } = await get<{ inquiry: Inquiry; events: InquiryEvent[] }>(
        `/admin/inquiries/${id}`,
      )
      if (req !== detailReqRef.current) return
      setDetail(data.inquiry)
      setEvents(data.events)
      setNote(data.inquiry.internal_note)
    } catch (e) {
      if (req !== detailReqRef.current) return
      setDetailError((e as Error).message)
    } finally {
      if (req === detailReqRef.current) setDetailLoading(false)
    }
  }, [])

  // 支持仪表盘 / 外部链接直达：?inquiry=ID
  useEffect(() => {
    const param = searchParams.get('inquiry')
    if (!param) {
      autoOpenedRef.current = null
      return
    }
    if (loading || autoOpenedRef.current === param) return
    const id = Number(param)
    if (!Number.isFinite(id) || id <= 0) return
    autoOpenedRef.current = param
    void openDetailById(id, list.find((i) => i.id === id))
  }, [searchParams, loading, list, openDetailById])

  const updateInquiry = async (patch: {
    status?: InquiryStatus
    internal_note?: string
  }): Promise<void> => {
    if (!detail) return
    setSaving(true)
    try {
      const { data } = await put<Inquiry>(`/admin/inquiries/${detail.id}`, patch)
      setDetail(data)
      setNote(data.internal_note)
      message.success('已保存')
      const { data: d2 } = await get<{ inquiry: Inquiry; events: InquiryEvent[] }>(
        `/admin/inquiries/${detail.id}`,
      )
      setDetail(d2.inquiry)
      setEvents(d2.events)
      void load()
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const resend = async (): Promise<void> => {
    if (!detail) return
    setResending(true)
    try {
      await post(`/admin/inquiries/${detail.id}/resend-notify`)
      message.success('邮件已重新发送')
      const { data } = await get<{ inquiry: Inquiry; events: InquiryEvent[] }>(
        `/admin/inquiries/${detail.id}`,
      )
      setDetail(data.inquiry)
      setEvents(data.events)
      void load()
    } catch (e) {
      message.error('重发失败：' + (e as Error).message)
    } finally {
      setResending(false)
    }
  }

  const remove = async (inq: Inquiry): Promise<void> => {
    try {
      await del(`/admin/inquiries/${inq.id}`)
      message.success('询价已删除')
      closeDetail()
      void load()
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  const closeDetail = (): void => {
    detailReqRef.current += 1
    setDetail(null)
    setDetailId(null)
    setEvents([])
    setDetailError('')
    setNote('')
    setDetailLoading(false)
    if (searchParams.get('inquiry')) {
      const next = new URLSearchParams(searchParams)
      next.delete('inquiry')
      setSearchParams(next, { replace: true })
    }
  }

  const exportCSV = (): void => {
    window.open('/api/v1/admin/inquiries/export?' + buildParams(), '_blank')
  }

  const hasFilters = keyword !== '' || q !== '' || status != null || range != null

  const resetFilters = (): void => {
    setKeyword('')
    setQ('')
    setStatus(undefined)
    setRange(null)
    setPage(1)
    const next = new URLSearchParams(searchParams)
    next.delete('status')
    next.delete('inquiry')
    setSearchParams(next, { replace: true })
  }

  const changeStatus = (v: InquiryStatus | undefined): void => {
    setStatus(v)
    setPage(1)
    const next = new URLSearchParams(searchParams)
    if (v) next.set('status', v)
    else next.delete('status')
    setSearchParams(next, { replace: true })
  }

  const handlePageChange = (p: number): void => {
    setPage(p)
    setPageSize(pageSize)
  }

  const detailOpen = detailId != null

  return (
    <div>
      <PageHeader
        title="询价管理"
        extra={
          <>
            <Tooltip title="刷新列表">
              <Button
                className="sc-icon-btn"
                aria-label="刷新列表"
                icon={<ReloadOutlined />}
                loading={loading}
                onClick={() => void load()}
              />
            </Tooltip>
            <Button icon={<DownloadOutlined />} onClick={exportCSV}>
              导出 CSV
            </Button>
          </>
        }
      />

      {error ? (
        <PageError message={error} onRetry={() => void load()} />
      ) : (
        <div className="sc-inbox">
          <div className={`sc-inbox__toolbar${detailOpen ? ' is-detail-open' : ''}`}>
            <Input.Search
              className="sc-inbox__search"
              placeholder="搜索姓名 / 公司 / 邮箱 / 产品"
              allowClear
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value)
                if (e.target.value === '' && q !== '') {
                  setQ('')
                  setPage(1)
                }
              }}
              onSearch={(v) => {
                setQ(v.trim())
                setPage(1)
              }}
            />
            <div className="sc-inbox__chips" role="group" aria-label="按状态筛选">
              {STATUS_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  className={`sc-inbox__chip${chip.value === status ? ' is-active' : ''}`}
                  onClick={() => changeStatus(chip.value)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <div className="sc-toolbar__spacer" />
            <DatePicker.RangePicker
              value={range}
              style={{ width: 240 }}
              onChange={(v) => {
                setRange(v)
                setPage(1)
              }}
            />
            <Tooltip title="清除筛选">
              <Button
                type="text"
                className="sc-icon-btn"
                aria-label="清除筛选"
                icon={<ClearOutlined />}
                disabled={!hasFilters}
                onClick={resetFilters}
              />
            </Tooltip>
          </div>

          <div className={`sc-inbox__list${detailOpen ? ' is-hidden-mobile' : ''}`}>
            <div className="sc-inbox__list-head">
              <span className="sc-inbox__list-title">询价列表</span>
              <span className="sc-toolbar__meta">共 {total} 条</span>
            </div>
            <div className="sc-inbox__items">
              {loading && list.length === 0 ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div className="sc-inbox-item" key={i} aria-hidden="true">
                    <Skeleton active title={{ width: '46%' }} paragraph={{ rows: 2 }} />
                  </div>
                ))
              ) : list.length === 0 ? (
                <EmptyState
                  bare
                  icon={<MailOutlined />}
                  title={hasFilters ? '没有符合筛选条件的询价' : '暂无询价'}
                  description={
                    hasFilters
                      ? '尝试调整关键词、状态或日期范围。'
                      : '客户通过公开站提交询价后，会出现在这里。'
                  }
                  action={
                    hasFilters ? (
                      <Button size="small" onClick={resetFilters}>
                        清除筛选
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                list.map((inq) => (
                  <button
                    type="button"
                    className={`sc-inbox-item${detailId === inq.id ? ' is-active' : ''}`}
                    key={inq.id}
                    onClick={() => void openDetailById(inq.id, inq)}
                    aria-current={detailId === inq.id ? 'true' : undefined}
                  >
                    <span className="sc-inbox-item__avatar" aria-hidden="true">
                      {initials(inq.name)}
                    </span>
                    <span className="sc-inbox-item__main">
                      <span className="sc-inbox-item__row1">
                        <span className="sc-inbox-item__name">
                          {inq.status === 'new' && (
                            <span className="sc-inquiry-row__new" aria-label="新询价" />
                          )}
                          {inq.name}
                        </span>
                        <span className="sc-inbox-item__side">
                          <InquiryStatusTag status={inq.status} />
                          <span className="sc-inbox-item__time">{shortTime(inq.created_at)}</span>
                        </span>
                      </span>
                      <span className="sc-inbox-item__sub">
                        <span className="sc-inbox-item__company">
                          {inq.company || '未填写公司'}
                        </span>
                        <span className="sc-inbox-item__id sc-mono">#{inq.id}</span>
                      </span>
                    </span>
                    <span className="sc-inbox-item__product">
                      <TagOutlined aria-hidden="true" />
                      <span className="sc-inbox-item__product-name">
                        {inq.product_name_snapshot || '未关联产品'}
                      </span>
                    </span>
                    <span className="sc-inbox-item__snippet">
                      {inq.message || inq.customization || '客户未填写留言'}
                    </span>
                  </button>
                ))
              )}
            </div>
            {total > pageSize && (
              <div className="sc-inbox__list-foot">
                <Pagination
                  size="small"
                  current={page}
                  pageSize={pageSize}
                  total={total}
                  showSizeChanger={false}
                  onChange={handlePageChange}
                />
              </div>
            )}
          </div>

          <div className={`sc-inbox__detail${detailOpen ? ' is-open-mobile' : ''}`}>
            {!detailOpen ? (
              <div className="sc-detail-placeholder">
                <div className="sc-placeholder-guide">
                  <span className="sc-placeholder-guide__icon" aria-hidden="true">
                    <InboxOutlined />
                  </span>
                  <p className="sc-placeholder-guide__title">选择一条询价开始处理</p>
                  <p className="sc-placeholder-guide__desc">
                    左侧列表展示客户、产品与状态，点击卡片即可在右侧查看完整需求并跟进。
                  </p>
                  <ol className="sc-placeholder-steps">
                    <li>
                      <i>1</i>
                      <div>
                        <b>打开询价</b>
                        <span>点击左侧客户卡片，查看联系方式与产品快照</span>
                      </div>
                    </li>
                    <li>
                      <i>2</i>
                      <div>
                        <b>核对需求</b>
                        <span>确认数量、定制要求与客户留言，及时回复客户</span>
                      </div>
                    </li>
                    <li>
                      <i>3</i>
                      <div>
                        <b>跟进留痕</b>
                        <span>更新处理状态、记录内部备注，操作自动写入事件历史</span>
                      </div>
                    </li>
                  </ol>
                </div>
              </div>
            ) : (
              <>
                <div className="sc-inbox__detail-head">
                  <div className="sc-inbox__customer">
                    <button type="button" className="sc-inbox__back" onClick={closeDetail}>
                      <ArrowLeftOutlined /> 返回列表
                    </button>
                    <div className="sc-inbox__id-row">
                      <span className="sc-inbox__avatar" aria-hidden="true">
                        {initials(detail?.name ?? '?')}
                      </span>
                      <div className="sc-inbox__id-text">
                        <h2 className="sc-inbox__name">{detail?.name ?? '询价详情'}</h2>
                        <div className="sc-inbox__company">
                          {detail
                            ? `${detail.company || '未填写公司'} · 询价 #${detail.id}`
                            : `询价 #${detailId ?? ''}`}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="sc-inbox__head-actions">
                    {detail && <InquiryStatusTag status={detail.status} />}
                    <Popconfirm
                      title="确认删除该询价？"
                      description="事件历史将一并删除"
                      okText="删除"
                      okButtonProps={{ danger: true }}
                      cancelText="取消"
                      onConfirm={() => detail && remove(detail)}
                    >
                      <Button danger size="small" disabled={!detail}>
                        删除
                      </Button>
                    </Popconfirm>
                  </div>
                </div>

                <div className="sc-inbox__scroll">
                  {detailError ? (
                    <PageError
                      message={detailError}
                      onRetry={() => detailId != null && void openDetailById(detailId)}
                    />
                  ) : detailLoading && !detail ? (
                    <div style={{ paddingTop: 20 }}>
                      <Skeleton active title paragraph={{ rows: 12 }} />
                    </div>
                  ) : detail ? (
                    <>
                      <section className="sc-inbox-section">
                        <div className="sc-inbox-section__label">客户信息</div>
                        <div className="sc-contact-grid">
                          <div className="sc-detail-field">
                            <span className="sc-detail-field__label">邮箱</span>
                            <span className="sc-detail-field__value">{detail.email}</span>
                          </div>
                          <div className="sc-detail-field">
                            <span className="sc-detail-field__label">WhatsApp / 电话</span>
                            <span className="sc-detail-field__value">
                              {detail.whatsapp_phone || '—'}
                            </span>
                          </div>
                          <div className="sc-detail-field">
                            <span className="sc-detail-field__label">来源页</span>
                            <span className="sc-detail-field__value">
                              {detail.source_page || '—'}
                            </span>
                          </div>
                          <div className="sc-detail-field">
                            <span className="sc-detail-field__label">提交时间</span>
                            <span className="sc-detail-field__value sc-tabular">
                              {fmtTime(detail.created_at)}
                            </span>
                          </div>
                          <div className="sc-detail-field">
                            <span className="sc-detail-field__label">IP 地址</span>
                            <span className="sc-detail-field__value sc-detail-field__value--mono">
                              {detail.ip || '—'}
                            </span>
                          </div>
                          <div className="sc-detail-field">
                            <span className="sc-detail-field__label">邮件通知</span>
                            <span className="sc-detail-field__value sc-status-row">
                              <NotifyStatusTag status={detail.email_notify_status} />
                              {(detail.email_notify_status === 'pending' ||
                                detail.email_notify_status === 'failed') && (
                                <Button
                                  size="small"
                                  type="text"
                                  icon={<RedoOutlined />}
                                  loading={resending}
                                  onClick={() => void resend()}
                                >
                                  重发
                                </Button>
                              )}
                            </span>
                          </div>
                        </div>
                      </section>

                      <section className="sc-inbox-section">
                        <div className="sc-inbox-section__label">需求概览</div>
                        <div className="sc-snapshot">
                          <span className="sc-thumb" aria-hidden="true">
                            <InboxOutlined />
                          </span>
                          <span className="sc-snapshot__body">
                            <span className="sc-snapshot__name">
                              {detail.product_name_snapshot || '产品已删除或未关联'}
                            </span>
                            {detail.product_sku_snapshot && (
                              <span className="sc-snapshot__meta">
                                {detail.product_sku_snapshot}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="sc-contact-grid" style={{ marginTop: 14 }}>
                          <div className="sc-detail-field">
                            <span className="sc-detail-field__label">预估数量</span>
                            <span className="sc-detail-field__value">
                              {detail.estimated_qty || '—'}
                            </span>
                          </div>
                          <div className="sc-detail-field">
                            <span className="sc-detail-field__label">定制要求</span>
                            <span className="sc-detail-field__value">
                              {detail.customization || '—'}
                            </span>
                          </div>
                        </div>
                      </section>

                      <section className="sc-inbox-section">
                        <div className="sc-inbox-section__label">客户留言</div>
                        <div
                          className={`sc-message${detail.message ? '' : ' sc-message--empty'}`}
                        >
                          {detail.message || '客户未填写额外留言。'}
                        </div>
                      </section>

                      <section className="sc-inbox-section">
                        <div className="sc-inbox-section__label">
                          <span>处理状态</span>
                          <span className="sc-inbox-section__hint">变更会记录到事件历史</span>
                        </div>
                        <div className="sc-status-row">
                          <Select
                            value={detail.status}
                            disabled={saving}
                            style={{ width: 168 }}
                            onChange={(v: InquiryStatus) => void updateInquiry({ status: v })}
                            options={STATUS_OPTIONS}
                          />
                          {saving && <span className="sc-helper">保存中…</span>}
                        </div>
                      </section>

                      <section className="sc-inbox-section">
                        <div className="sc-inbox-section__label">
                          <span>内部备注</span>
                          <span className="sc-inbox-section__hint">仅后台可见，客户不会收到</span>
                        </div>
                        <div className="sc-note-block">
                          <Input.TextArea
                            rows={4}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="记录跟进进度、报价、样品寄送等信息…"
                            maxLength={5000}
                          />
                          <div className="sc-note-block__foot">
                            <span className="sc-note-block__hint">{note.length} / 5000</span>
                            <Button
                              type="primary"
                              size="small"
                              loading={saving}
                              disabled={note === detail.internal_note}
                              onClick={() => void updateInquiry({ internal_note: note })}
                            >
                              保存备注
                            </Button>
                          </div>
                        </div>
                      </section>

                      <section className="sc-inbox-section">
                        <div className="sc-inbox-section__label">事件历史</div>
                        {events.length === 0 ? (
                          <p className="sc-helper">暂无事件记录。</p>
                        ) : (
                          <div className="sc-timeline">
                            {events.map((e) => (
                              <div
                                className={`sc-timeline-item sc-timeline-item--${e.event_type}`}
                                key={e.id}
                              >
                                <div className="sc-timeline-item__label">{eventLabel(e)}</div>
                                {e.detail && (
                                  <div className="sc-timeline-item__detail">{e.detail}</div>
                                )}
                                <div className="sc-timeline-item__time">
                                  {fmtTime(e.created_at)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    </>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
