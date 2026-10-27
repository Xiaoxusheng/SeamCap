import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Button, Tooltip } from 'antd'
import {
  AppstoreOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  EditOutlined,
  InboxOutlined,
  MailOutlined,
  PictureOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { fetchDashboard } from '../../api/dashboard'
import type { DashboardData, Inquiry, Product } from '../../api/types'
import { InquiryStatusTag, ProductStatusTag } from '../../components/StatusTag'
import PageHeader from '../../components/PageHeader'
import PageError from '../../components/PageError'
import EmptyState from '../../components/EmptyState'

function shortTime(s: string): string {
  const d = dayjs(s)
  return d.isValid() ? d.format('MM-DD HH:mm') : '—'
}

function percent(value: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((value / total) * 100)
}

function FeedThumb({ product }: { product: Product }): JSX.Element {
  const media = product.main_image
  if (media && !media.mime_type.startsWith('video')) {
    return (
      <span className="sc-feed-row__thumb">
        <img src={media.url} alt={`${product.name} 主图`} loading="lazy" />
      </span>
    )
  }
  return (
    <span className="sc-feed-row__thumb" aria-hidden="true">
      {media ? <PictureOutlined /> : <InboxOutlined />}
    </span>
  )
}

type Tone = 'green' | 'amber' | 'blue' | 'coral'

function Metric({
  icon,
  tone,
  label,
  value,
  suffix,
  meta,
  progress,
  progressLabel,
  badge,
  onClick,
  ariaLabel,
}: {
  icon: ReactNode
  tone: Tone
  label: string
  value: number
  suffix?: ReactNode
  meta: string
  progress?: number
  progressLabel?: string
  badge?: string
  onClick?: () => void
  ariaLabel?: string
}): JSX.Element {
  const classes = ['sc-metric', onClick ? 'sc-metric--link' : ''].filter(Boolean).join(' ')
  const pct = progress == null ? null : Math.max(0, Math.min(100, progress))

  return (
    <div
      className={classes}
      role={onClick ? 'link' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? ariaLabel : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
    >
      <div className="sc-metric__head">
        <span className="sc-metric__label">{label}</span>
        <span className={`sc-metric__icon sc-metric__icon--${tone}`} aria-hidden="true">
          {icon}
        </span>
      </div>
      <div className="sc-metric__value">
        {value}
        {suffix && <span className="sc-metric__suffix">{suffix}</span>}
      </div>
      <div className="sc-metric__foot">
        <div className="sc-metric__meta-row">
          <span className="sc-metric__meta">{meta}</span>
          {badge && (
            <span className={`sc-metric__badge sc-metric__badge--${tone}`}>{badge}</span>
          )}
        </div>
        {pct != null && (
          <div
            className="sc-metric__progress"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={progressLabel}
          >
            <span
              className={`sc-metric__progress-fill sc-metric__progress-fill--${tone}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// 仪表盘：真实统计 + 内容资产 / 待处理事项 + 最近询价 / 最近更新产品
export default function Dashboard(): JSX.Element {
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadedAt, setLoadedAt] = useState('')

  const load = useCallback(async (force = false): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const d = await fetchDashboard(force)
      setData(d)
      setLoadedAt(dayjs().format('HH:mm'))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const header = (
    <PageHeader
      className="sc-page-head--dashboard"
      title="工作台"
      description={
        <>
          产品、工艺与客户询价的运营概览
          <span className="sc-muted">
            {' · '}
            {dayjs().format('M月D日 dddd')}
            {loadedAt ? ` · 数据于 ${loadedAt} 更新` : ''}
          </span>
        </>
      }
      extra={
        <>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/admin/products/new')}
          >
            新建产品
          </Button>
          <Button
            icon={<CloudUploadOutlined />}
            onClick={() => navigate('/admin/media')}
          >
            上传素材
          </Button>
          <Button
            icon={<MailOutlined />}
            onClick={() => navigate('/admin/inquiries?status=new')}
          >
            处理新询价
          </Button>
          <Tooltip title="刷新数据">
            <Button
              type="text"
              className="sc-icon-btn"
              aria-label="刷新数据"
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={() => void load(true)}
            />
          </Tooltip>
        </>
      }
    />
  )

  if (error) {
    return (
      <div>
        {header}
        <PageError message={error} onRetry={() => void load(true)} />
      </div>
    )
  }

  if (loading && !data) {
    return (
      <div>
        {header}
        <div className="sc-metrics" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="sc-metric" key={i}>
              <div className="sc-metric__head">
                <div className="sc-skeleton sc-skel-line sc-skel-line--short" />
                <div className="sc-skeleton" style={{ width: 34, height: 34, borderRadius: 17 }} />
              </div>
              <div className="sc-skeleton" style={{ width: 78, height: 32, margin: '9px 0 6px' }} />
              <div className="sc-skeleton" style={{ width: 120, height: 10 }} />
            </div>
          ))}
        </div>
        <div className="sc-dash-mid">
          {[0, 1].map((i) => (
            <div className="sc-panel" key={i}>
              <div className="sc-panel-head">
                <div className="sc-skeleton" style={{ width: 110, height: 14 }} />
              </div>
              <div className="sc-panel__body">
                <div className="sc-skeleton" style={{ height: 150, borderRadius: 8 }} />
              </div>
            </div>
          ))}
        </div>
        <div className="sc-dash-bottom">
          {[0, 1].map((i) => (
            <div className="sc-panel" key={i}>
              <div className="sc-panel-head">
                <div className="sc-skeleton" style={{ width: 96, height: 14 }} />
              </div>
              <div className="sc-panel__body">
                {Array.from({ length: 4 }).map((_, r) => (
                  <div className="sc-skeleton sc-skel-line" key={r} style={{ marginBottom: 14 }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!data) return <div>{header}</div>

  const productTotal =
    data.products.published + data.products.draft + data.products.archived
  const craftUnpublished = Math.max(0, data.craftsmanship.total - data.craftsmanship.published)
  const pendingTotal = data.inquiries.new + data.products.draft + craftUnpublished

  const productSegments = [
    { key: 'published', value: data.products.published, label: '已发布' },
    { key: 'draft', value: data.products.draft, label: '草稿' },
    { key: 'archived', value: data.products.archived, label: '归档' },
  ]
  const craftSegments = [
    { key: 'published', value: data.craftsmanship.published, label: '已发布' },
    { key: 'unpublished', value: craftUnpublished, label: '未发布' },
  ]

  return (
    <div>
      {header}

      <div className="sc-metrics sc-stagger">
        <Metric
          icon={<CheckCircleOutlined />}
          tone="green"
          label="已发布产品"
          value={data.products.published}
          meta="公开站当前可见"
          progress={percent(data.products.published, productTotal)}
          progressLabel={`已发布产品占全部产品的 ${percent(
            data.products.published,
            productTotal,
          )}%`}
          ariaLabel="查看已发布产品"
          onClick={() => navigate('/admin/products?status=published')}
        />
        <Metric
          icon={<EditOutlined />}
          tone="amber"
          label="草稿产品"
          value={data.products.draft}
          meta="待完善后发布"
          badge={data.products.draft > 0 ? '待完善' : undefined}
          ariaLabel="查看草稿产品"
          onClick={() => navigate('/admin/products?status=draft')}
        />
        <Metric
          icon={<ToolOutlined />}
          tone="blue"
          label="已发布工艺"
          value={data.craftsmanship.published}
          suffix={<span className="sc-metric__suffix-divider">/ {data.craftsmanship.total}</span>}
          meta="已发布 / 工艺总数"
          progress={percent(data.craftsmanship.published, data.craftsmanship.total)}
          progressLabel={`已发布工艺占全部工艺内容的 ${percent(
            data.craftsmanship.published,
            data.craftsmanship.total,
          )}%`}
          ariaLabel="查看工艺内容"
          onClick={() => navigate('/admin/craftsmanship')}
        />
        <Metric
          icon={<MailOutlined />}
          tone="coral"
          label="新询价"
          value={data.inquiries.new}
          meta={data.inquiries.new > 0 ? '待跟进的客户线索' : '暂无待处理询价'}
          badge={data.inquiries.new > 0 ? '待跟进' : undefined}
          ariaLabel="查看新询价"
          onClick={() => navigate('/admin/inquiries?status=new')}
        />
      </div>

      <div className="sc-dash-mid">
        <section className="sc-panel">
          <div className="sc-panel-head">
            <h2 className="sc-panel-head__title">内容资产概览</h2>
            <button
              type="button"
              className="sc-panel-link"
              onClick={() => navigate('/admin/products')}
            >
              管理内容 <ArrowRightOutlined />
            </button>
          </div>
          <div className="sc-panel__body sc-compo">
            <div className="sc-compo__block">
              <div className="sc-compo__head">
                <span className="sc-compo__title">产品目录</span>
                <span className="sc-compo__total">{productTotal} 个产品</span>
              </div>
              <div className="sc-compo__bar" aria-hidden="true">
                {productTotal > 0 ? (
                  productSegments.map((seg) =>
                    seg.value > 0 ? (
                      <span
                        key={seg.key}
                        className={`sc-compo__seg sc-compo__seg--${seg.key}`}
                        style={{ width: `${percent(seg.value, productTotal)}%` }}
                        title={`${seg.label} ${seg.value}`}
                      />
                    ) : null,
                  )
                ) : (
                  <span className="sc-compo__seg sc-compo__seg--empty" style={{ width: '100%' }} />
                )}
              </div>
              <div className="sc-compo__legend">
                <span>
                  <i className="sc-compo__dot sc-compo__dot--published" aria-hidden="true" />
                  已发布 <strong>{data.products.published}</strong>
                </span>
                <span>
                  <i className="sc-compo__dot sc-compo__dot--draft" aria-hidden="true" />
                  草稿 <strong>{data.products.draft}</strong>
                </span>
                <span>
                  <i className="sc-compo__dot sc-compo__dot--archived" aria-hidden="true" />
                  归档 <strong>{data.products.archived}</strong>
                </span>
              </div>
            </div>

            <div className="sc-compo__block">
              <div className="sc-compo__head">
                <span className="sc-compo__title">工艺内容</span>
                <span className="sc-compo__total">{data.craftsmanship.total} 篇工艺</span>
              </div>
              <div className="sc-compo__bar" aria-hidden="true">
                {data.craftsmanship.total > 0 ? (
                  craftSegments.map((seg) =>
                    seg.value > 0 ? (
                      <span
                        key={seg.key}
                        className={`sc-compo__seg sc-compo__seg--craft${
                          seg.key === 'unpublished' ? ' sc-compo__seg--unpublished' : ''
                        }`}
                        style={{
                          width: `${percent(seg.value, data.craftsmanship.total)}%`,
                        }}
                        title={`${seg.label} ${seg.value}`}
                      />
                    ) : null,
                  )
                ) : (
                  <span className="sc-compo__seg sc-compo__seg--empty" style={{ width: '100%' }} />
                )}
              </div>
              <div className="sc-compo__legend">
                <span>
                  <i className="sc-compo__dot sc-compo__dot--craft" aria-hidden="true" />
                  已发布 <strong>{data.craftsmanship.published}</strong>
                </span>
                <span>
                  <i className="sc-compo__dot sc-compo__dot--unpublished" aria-hidden="true" />
                  未发布 <strong>{craftUnpublished}</strong>
                </span>
              </div>
            </div>

            <p className="sc-compo__note">
              归档与草稿产品、未发布工艺不会出现在公开站。
            </p>
          </div>
        </section>

        <section className="sc-panel sc-panel--flush">
          <div className="sc-panel-head">
            <h2 className="sc-panel-head__title">待处理事项</h2>
            <span className="sc-panel-head__meta">
              {pendingTotal > 0 ? `共 ${pendingTotal} 项` : '已全部处理'}
            </span>
          </div>
          <div className="sc-task-list">
            <button
              type="button"
              className="sc-task-row"
              onClick={() => navigate('/admin/inquiries?status=new')}
            >
              <span className="sc-task-row__icon sc-task-row__icon--coral" aria-hidden="true">
                <MailOutlined />
              </span>
              <span className="sc-task-row__body">
                <span className="sc-task-row__title">新询价待跟进</span>
                <span className="sc-task-row__desc">
                  {data.inquiries.new > 0
                    ? '客户通过公开站提交，等待响应'
                    : '所有新询价均已跟进'}
                </span>
              </span>
              <span
                className={`sc-task-row__count${data.inquiries.new === 0 ? ' is-zero' : ''}`}
              >
                {data.inquiries.new}
              </span>
              <RightOutlined className="sc-task-row__arrow" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="sc-task-row"
              onClick={() => navigate('/admin/products?status=draft')}
            >
              <span className="sc-task-row__icon sc-task-row__icon--amber" aria-hidden="true">
                <EditOutlined />
              </span>
              <span className="sc-task-row__body">
                <span className="sc-task-row__title">草稿产品待完善</span>
                <span className="sc-task-row__desc">
                  {data.products.draft > 0
                    ? '补齐内容后即可发布到公开站'
                    : '暂无待完善的草稿产品'}
                </span>
              </span>
              <span
                className={`sc-task-row__count${data.products.draft === 0 ? ' is-zero' : ''}`}
              >
                {data.products.draft}
              </span>
              <RightOutlined className="sc-task-row__arrow" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="sc-task-row"
              onClick={() => navigate('/admin/craftsmanship')}
            >
              <span className="sc-task-row__icon sc-task-row__icon--blue" aria-hidden="true">
                <ToolOutlined />
              </span>
              <span className="sc-task-row__body">
                <span className="sc-task-row__title">未发布工艺待处理</span>
                <span className="sc-task-row__desc">
                  {craftUnpublished > 0 ? '草稿或隐藏工艺尚未对外展示' : '全部工艺均已发布'}
                </span>
              </span>
              <span className={`sc-task-row__count${craftUnpublished === 0 ? ' is-zero' : ''}`}>
                {craftUnpublished}
              </span>
              <RightOutlined className="sc-task-row__arrow" aria-hidden="true" />
            </button>
          </div>
        </section>
      </div>

      <div className="sc-dash-bottom">
        <section className="sc-panel sc-panel--flush">
          <div className="sc-panel-head">
            <h2 className="sc-panel-head__title">最近询价</h2>
            <button
              type="button"
              className="sc-panel-link"
              onClick={() => navigate('/admin/inquiries')}
            >
              进入询价管理 <ArrowRightOutlined />
            </button>
          </div>
          {data.recent_inquiries.length === 0 ? (
            <EmptyState
              bare
              icon={<MailOutlined />}
              title="暂无询价"
              description="客户通过公开站提交询价后，会出现在这里"
              className="sc-dashboard-empty"
            />
          ) : (
            <div className="sc-recent">
              <div className="sc-recent__head" aria-hidden="true">
                <span>客户</span>
                <span>公司</span>
                <span>产品</span>
                <span>状态</span>
                <span>提交时间</span>
              </div>
              {data.recent_inquiries.map((inq: Inquiry) => (
                <button
                  type="button"
                  className="sc-recent__row"
                  key={inq.id}
                  onClick={() => navigate(`/admin/inquiries?inquiry=${inq.id}`)}
                  aria-label={`查看询价：${inq.name}`}
                >
                  <span className="sc-recent__customer">
                    {inq.status === 'new' && (
                      <i className="sc-recent__dot" aria-label="新询价" />
                    )}
                    <span className="sc-recent__ellipsis">{inq.name}</span>
                  </span>
                  <span className="sc-recent__company" title={inq.company || undefined}>
                    {inq.company || '—'}
                  </span>
                  <span
                    className="sc-recent__product"
                    title={inq.product_name_snapshot || undefined}
                  >
                    {inq.product_name_snapshot || '未关联产品'}
                  </span>
                  <span className="sc-recent__status">
                    <InquiryStatusTag status={inq.status} />
                  </span>
                  <span className="sc-recent__time">{shortTime(inq.created_at)}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="sc-panel sc-panel--flush">
          <div className="sc-panel-head">
            <h2 className="sc-panel-head__title">最近更新产品</h2>
            <button
              type="button"
              className="sc-panel-link"
              onClick={() => navigate('/admin/products')}
            >
              全部产品 <ArrowRightOutlined />
            </button>
          </div>
          {data.recent_products.length === 0 ? (
            <EmptyState
              bare
              icon={<AppstoreOutlined />}
              title="暂无产品"
              description="创建第一个产品后，这里会显示最近更新"
              className="sc-dashboard-empty"
            />
          ) : (
            <div className="sc-feed-list">
              {data.recent_products.slice(0, 5).map((p: Product, index) => (
                <button
                  type="button"
                  className="sc-feed-row"
                  key={p.id}
                  onClick={() => navigate(`/admin/products/${p.id}/edit`)}
                  aria-label={`编辑产品：${p.name}`}
                >
                  <span className="sc-feed-row__index" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <FeedThumb product={p} />
                  <span className="sc-feed-row__body">
                    <span className="sc-feed-row__line">
                      <span className="sc-feed-row__name">{p.name}</span>
                      <ProductStatusTag status={p.status} />
                    </span>
                    <span className="sc-feed-row__line sc-feed-row__line--meta">
                      <span className="sc-mono sc-feed-row__sku">
                        {p.sku || '未设置 SKU'}
                      </span>
                      <span className="sc-tabular sc-feed-row__time">
                        {shortTime(p.updated_at)}
                      </span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
