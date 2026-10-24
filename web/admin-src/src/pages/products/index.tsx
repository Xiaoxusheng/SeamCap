import { useCallback, useEffect, useState } from 'react'
import {
  App,
  Button,
  Dropdown,
  Input,
  Pagination,
  Select,
  Table,
  Tooltip,
} from 'antd'
import type { MenuProps } from 'antd'
import {
  AppstoreOutlined,
  ClearOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  MoreOutlined,
  PictureOutlined,
  PlusOutlined,
  ReloadOutlined,
  StarFilled,
  StarOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { del, fmtTime, get, post, put } from '../../api/client'
import type { Category, Product, ProductStatus } from '../../api/types'
import { ProductStatusTag } from '../../components/StatusTag'
import PageHeader from '../../components/PageHeader'
import PageError from '../../components/PageError'
import MediaThumb from '../../components/MediaThumb'
import EmptyState from '../../components/EmptyState'
import TableSkeleton from '../../components/TableSkeleton'
import type { ColumnsType } from 'antd/es/table'

type ViewMode = 'grid' | 'table'

const STATUS_OPTIONS = [
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已发布' },
  { value: 'archived', label: '已归档' },
]

function parseStatus(v: string | null): ProductStatus | undefined {
  return v === 'draft' || v === 'published' || v === 'archived' ? v : undefined
}

// 产品目录：图片目录 / 紧凑表格双视图 + 关键词/分类/状态筛选 + 分页
export default function ProductList(): JSX.Element {
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const status = parseStatus(searchParams.get('status'))
  const categoryParam = searchParams.get('category_id')
  const categoryId =
    categoryParam != null && categoryParam !== '' && Number.isFinite(Number(categoryParam))
      ? Number(categoryParam)
      : undefined
  const urlQ = searchParams.get('q') ?? ''

  const [keyword, setKeyword] = useState(urlQ)
  const [q, setQ] = useState(urlQ)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [view, setView] = useState<ViewMode>('grid')
  const [list, setList] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [busyId, setBusyId] = useState<number | null>(null)

  useEffect(() => {
    void get<Category[]>('/admin/categories')
      .then(({ data }) => setCategories(data))
      .catch(() => {})
  }, [])

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(page), per_page: String(pageSize) })
      if (q) params.set('q', q)
      if (categoryId != null) params.set('category_id', String(categoryId))
      if (status) params.set('status', status)
      const { data, pagination } = await get<Product[]>('/admin/products?' + params.toString())
      setList(data)
      setTotal(pagination?.total ?? 0)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, q, categoryId, status])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setKeyword(urlQ)
    setQ(urlQ)
    setPage(1)
  }, [urlQ])

  const setQueryFilter = (key: 'status' | 'category_id' | 'q', value?: string): void => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
    setPage(1)
  }

  const duplicate = async (p: Product): Promise<void> => {
    setBusyId(p.id)
    try {
      const { data } = await post<Product>(`/admin/products/${p.id}/duplicate`)
      message.success(`已复制为草稿：${data.slug}`)
      await load()
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (p: Product): Promise<void> => {
    setBusyId(p.id)
    try {
      await del(`/admin/products/${p.id}`)
      message.success(`已删除「${p.name}」（历史询价快照保留）`)
      await load()
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  const toggleFeatured = async (p: Product): Promise<void> => {
    setBusyId(p.id)
    try {
      await put(`/admin/products/${p.id}`, {
        name: p.name,
        sku: p.sku,
        slug: p.slug,
        category_id: p.category_id,
        short_desc: p.short_desc,
        detail_desc: p.detail_desc,
        material: p.material,
        cap_shape: p.cap_shape,
        colors: p.colors,
        sizes: p.sizes,
        customization: p.customization,
        main_image_id: p.main_image_id,
        video_url: p.video_url,
        is_featured: !p.is_featured,
        sort_order: p.sort_order,
        status: p.status,
        seo_title: p.seo_title,
        seo_desc: p.seo_desc,
      })
      message.success(p.is_featured ? '已取消首页精选' : '已设为首页精选')
      await load()
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  const confirmRemove = (p: Product): void => {
    modal.confirm({
      title: `删除「${p.name}」？`,
      content: '询价中的产品快照会保留。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => remove(p),
    })
  }

  const moreMenu = (p: Product): MenuProps => ({
    items: [
      { key: 'edit', icon: <EditOutlined />, label: '编辑' },
      { key: 'copy', icon: <CopyOutlined />, label: '复制为草稿' },
      {
        key: 'featured',
        icon: p.is_featured ? <StarOutlined /> : <StarFilled />,
        label: p.is_featured ? '取消首页精选' : '设为首页精选',
      },
      { type: 'divider' },
      { key: 'delete', danger: true, icon: <DeleteOutlined />, label: '删除' },
    ],
    onClick: ({ key, domEvent }) => {
      domEvent.stopPropagation()
      if (key === 'edit') navigate(`/admin/products/${p.id}/edit`)
      if (key === 'copy') void duplicate(p)
      if (key === 'featured') void toggleFeatured(p)
      if (key === 'delete') confirmRemove(p)
    },
  })

  const hasFilters = keyword !== '' || q !== '' || categoryId != null || status != null

  const resetFilters = (): void => {
    setKeyword('')
    setQ('')
    const next = new URLSearchParams(searchParams)
    next.delete('status')
    next.delete('category_id')
    next.delete('q')
    setSearchParams(next, { replace: true })
    setPage(1)
  }

  const changePage = (p: number, ps: number): void => {
    setPage(p)
    setPageSize(ps)
  }

  const columns: ColumnsType<Product> = [
    {
      title: '产品',
      dataIndex: 'name',
      ellipsis: true,
      render: (v: string, r: Product) => (
        <div className="sc-entity">
          <MediaThumb media={r.main_image} alt={`${v} 主图`} />
          <div className="sc-entity__text">
            <div className="sc-entity__title">{v}</div>
            <div className="sc-entity__meta sc-entity__meta--mono">
              {r.sku || '未设置 SKU'}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 130,
      responsive: ['lg'],
      ellipsis: true,
      render: (_, r) => r.category?.name ?? <span className="sc-cell-secondary">未分类</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      responsive: ['sm'],
      render: (v: ProductStatus) => <ProductStatusTag status={v} />,
    },
    {
      title: '精选',
      dataIndex: 'is_featured',
      width: 70,
      align: 'center',
      responsive: ['md'],
      render: (v: boolean, r) => (
        <Tooltip title={v ? '取消首页精选' : '设为首页精选'}>
          <Button
            type="text"
            size="small"
            aria-label={v ? '取消首页精选' : '设为首页精选'}
            loading={busyId === r.id}
            disabled={busyId === r.id}
            icon={
              v ? (
                <StarFilled style={{ color: 'var(--sc-amber)' }} />
              ) : (
                <StarOutlined style={{ color: 'var(--sc-ink-disabled)' }} />
              )
            }
            onClick={() => void toggleFeatured(r)}
          />
        </Tooltip>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 152,
      responsive: ['xl'],
      render: (v: string) => <span className="sc-tabular sc-cell-secondary">{fmtTime(v)}</span>,
    },
    {
      title: '',
      key: 'actions',
      width: 88,
      align: 'right',
      render: (_, r) => (
        <div className="sc-cell-actions">
          <Button
            type="link"
            size="small"
            onClick={() => navigate(`/admin/products/${r.id}/edit`)}
          >
            编辑
          </Button>
          <Dropdown menu={moreMenu(r)} trigger={['click']} placement="bottomRight">
            <Button
              type="text"
              size="small"
              aria-label="更多操作"
              icon={<MoreOutlined />}
              loading={busyId === r.id}
              disabled={busyId === r.id}
            />
          </Dropdown>
        </div>
      ),
    },
  ]

  const grid = (
    <div className="sc-product-grid">
      {list.map((p) => (
        <article className="sc-product-card" key={p.id}>
          <div className="sc-product-card__media">
            <button
              type="button"
              className="sc-product-card__image-btn"
              onClick={() => navigate(`/admin/products/${p.id}/edit`)}
              aria-label={`编辑产品：${p.name}`}
            >
              {p.main_image && !p.main_image.mime_type.startsWith('video') ? (
                <img src={p.main_image.url} alt={`${p.name} 主图`} loading="lazy" />
              ) : (
                <span className="sc-product-card__placeholder">
                  <PictureOutlined />
                  暂无主图
                </span>
              )}
            </button>
            <Tooltip title={p.is_featured ? '取消首页精选' : '设为首页精选'}>
              <button
                type="button"
                className={`sc-product-card__featured${p.is_featured ? '' : ' is-off'}`}
                aria-label={p.is_featured ? '取消首页精选' : '设为首页精选'}
                aria-pressed={p.is_featured}
                disabled={busyId === p.id}
                onClick={() => void toggleFeatured(p)}
              >
                {p.is_featured ? <StarFilled /> : <StarOutlined />}
              </button>
            </Tooltip>
          </div>
          <div className="sc-product-card__body">
            <button
              type="button"
              className="sc-product-card__title"
              onClick={() => navigate(`/admin/products/${p.id}/edit`)}
            >
              {p.name}
            </button>
            <div className="sc-product-card__meta">
              <span className="sc-product-card__sku">{p.sku || '未设置 SKU'}</span>
              <span className="sc-product-card__category">
                {p.category?.name ?? '未分类'}
              </span>
            </div>
            <div className="sc-product-card__tags">
              <ProductStatusTag status={p.status} />
            </div>
            <div className="sc-product-card__foot">
              <span className="sc-product-card__updated">{fmtTime(p.updated_at)}</span>
              <div className="sc-product-card__actions">
                <Button
                  type="link"
                  size="small"
                  onClick={() => navigate(`/admin/products/${p.id}/edit`)}
                >
                  编辑
                </Button>
                <Dropdown menu={moreMenu(p)} trigger={['click']} placement="bottomRight">
                  <Button
                    type="text"
                    size="small"
                    aria-label="更多操作"
                    icon={<MoreOutlined />}
                    loading={busyId === p.id}
                    disabled={busyId === p.id}
                  />
                </Dropdown>
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  )

  return (
    <div>
      <PageHeader
        title="产品管理"
        description="维护产品目录、图片与发布状态；公开站仅展示已发布产品。"
        extra={
          <>
            <div className="sc-view-toggle" role="group" aria-label="视图切换">
              <button
                type="button"
                className={`sc-view-toggle__btn${view === 'grid' ? ' is-active' : ''}`}
                aria-pressed={view === 'grid'}
                onClick={() => setView('grid')}
              >
                <AppstoreOutlined />
                目录
              </button>
              <button
                type="button"
                className={`sc-view-toggle__btn${view === 'table' ? ' is-active' : ''}`}
                aria-pressed={view === 'table'}
                onClick={() => setView('table')}
              >
                <UnorderedListOutlined />
                表格
              </button>
            </div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/admin/products/new')}
            >
              新建产品
            </Button>
          </>
        }
      />

      {error ? (
        <PageError message={error} onRetry={() => void load()} />
      ) : (
        <>
          <div className="sc-filterbar">
            <Input.Search
              className="sc-toolbar__search"
              placeholder="搜索名称 / SKU"
              allowClear
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value)
                if (e.target.value === '' && q !== '') {
                  setQ('')
                  setQueryFilter('q', undefined)
                }
              }}
              onSearch={(v) => {
                const next = v.trim()
                setQ(next)
                setQueryFilter('q', next || undefined)
              }}
            />
            <Select
              placeholder="全部分类"
              allowClear
              style={{ width: 166 }}
              value={categoryId}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              onChange={(v) => setQueryFilter('category_id', v != null ? String(v) : undefined)}
            />
            <Select
              placeholder="全部状态"
              allowClear
              style={{ width: 128 }}
              value={status}
              options={STATUS_OPTIONS}
              onChange={(v) => setQueryFilter('status', v)}
            />
            <Button
              type="text"
              icon={<ClearOutlined />}
              disabled={!hasFilters}
              onClick={resetFilters}
            >
              清除筛选
            </Button>
            <div className="sc-toolbar__spacer" />
            <span className="sc-toolbar__meta">共 {total} 个产品</span>
            <Tooltip title="刷新列表">
              <Button
                type="text"
                className="sc-icon-btn"
                aria-label="刷新列表"
                icon={<ReloadOutlined />}
                loading={loading}
                onClick={() => void load()}
              />
            </Tooltip>
          </div>

          {loading && list.length === 0 ? (
            view === 'grid' ? (
              <div className="sc-product-grid" aria-hidden="true">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div className="sc-product-card" key={i}>
                    <div className="sc-skeleton sc-skel-media" />
                    <div className="sc-product-card__body">
                      <div className="sc-skeleton sc-skel-line" style={{ width: '82%' }} />
                      <div className="sc-skeleton sc-skel-line sc-skel-line--short" />
                      <div className="sc-skeleton sc-skel-line" style={{ width: '55%', height: 22 }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="sc-table-panel">
                <TableSkeleton rows={8} columns={5} thumb />
              </div>
            )
          ) : list.length === 0 ? (
            <EmptyState
              className="sc-panel"
              icon={<AppstoreOutlined />}
              title={hasFilters ? '没有符合筛选条件的产品' : '还没有产品'}
              description={
                hasFilters
                  ? '尝试调整关键词、分类或状态筛选。'
                  : '创建第一个产品，开始搭建公开站的产品目录。'
              }
              action={
                hasFilters ? (
                  <Button onClick={resetFilters}>清除筛选</Button>
                ) : (
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => navigate('/admin/products/new')}
                  >
                    新建产品
                  </Button>
                )
              }
            />
          ) : view === 'grid' ? (
            <>
              {grid}
              <div className="sc-list-pagination">
                <Pagination
                  current={page}
                  pageSize={pageSize}
                  total={total}
                  showSizeChanger
                  showTotal={(t) => `共 ${t} 个产品`}
                  onChange={changePage}
                />
              </div>
            </>
          ) : (
            <div className="sc-table-panel">
              <Table
                className="sc-table sc-table--products"
                rowKey="id"
                columns={columns}
                dataSource={list}
                loading={loading}
                pagination={{
                  current: page,
                  pageSize,
                  total,
                  showSizeChanger: true,
                  showTotal: (t) => `共 ${t} 个产品`,
                  onChange: changePage,
                }}
                locale={{
                  emptyText: (
                    <EmptyState
                      bare
                      icon={<AppstoreOutlined />}
                      title="暂无产品"
                      description="尝试清除筛选，或创建第一个产品。"
                    />
                  ),
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
