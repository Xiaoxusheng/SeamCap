import { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, Input, Popconfirm, Select, Space, Table } from 'antd'
import { PlusOutlined, StarFilled, StarOutlined } from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { del, fmtTime, get, post, put } from '../../api/client'
import type { Category, Product, ProductStatus } from '../../api/types'
import { ProductStatusTag } from '../../components/StatusTag'
import PageHeader from '../../components/PageHeader'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'

// 产品列表：关键词/分类/状态筛选 + 复制/删除
export default function ProductList(): JSX.Element {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [q, setQ] = useState('')
  const [categoryId, setCategoryId] = useState<number | undefined>(
    searchParams.get('category_id') ? Number(searchParams.get('category_id')) : undefined,
  )
  const [status, setStatus] = useState<ProductStatus | undefined>(
    (searchParams.get('status') as ProductStatus | null) ?? undefined,
  )
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [list, setList] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    void get<Category[]>('/admin/categories')
      .then(({ data }) => setCategories(data))
      .catch(() => {})
  }, [])

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), per_page: String(pageSize) })
      if (q) params.set('q', q)
      if (categoryId != null) params.set('category_id', String(categoryId))
      if (status) params.set('status', status)
      const { data, pagination } = await get<Product[]>('/admin/products?' + params.toString())
      setList(data)
      setTotal(pagination?.total ?? 0)
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [message, page, pageSize, q, categoryId, status])

  useEffect(() => {
    void load()
  }, [load])

  const duplicate = async (p: Product): Promise<void> => {
    try {
      const { data } = await post<Product>(`/admin/products/${p.id}/duplicate`)
      message.success(`已复制为草稿：${data.slug}`)
      void load()
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  const remove = async (p: Product): Promise<void> => {
    try {
      await del(`/admin/products/${p.id}`)
      message.success(`已删除「${p.name}」（历史询价快照保留）`)
      void load()
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  const toggleFeatured = async (p: Product): Promise<void> => {
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
      void load()
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  const columns: ColumnsType<Product> = [
    {
      title: '主图',
      dataIndex: 'main_image',
      width: 64,
      render: (_, r) =>
        r.main_image && !r.main_image.mime_type.startsWith('video') ? (
          <img
            src={r.main_image.url}
            alt={r.main_image.alt_text}
            style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid #E3E7ED' }}
          />
        ) : (
          <span style={{ display: 'inline-block', width: 40, height: 40, borderRadius: 6, background: '#F1F3F6' }} />
        ),
    },
    { title: '名称', dataIndex: 'name', ellipsis: true },
    { title: 'SKU', dataIndex: 'sku', width: 120, render: (v: string) => v || '—' },
    { title: '分类', dataIndex: 'category', width: 130, render: (_, r) => r.category?.name ?? '—' },
    { title: '状态', dataIndex: 'status', width: 92, render: (v: ProductStatus) => <ProductStatusTag status={v} /> },
    {
      title: '精选',
      dataIndex: 'is_featured',
      width: 72,
      render: (v: boolean, r) => (
        <Button
          type="text"
          size="small"
          icon={v ? <StarFilled style={{ color: '#B7791F' }} /> : <StarOutlined style={{ color: '#9299A5' }} />}
          onClick={() => void toggleFeatured(r)}
          title={v ? '取消首页精选' : '设为首页精选'}
        />
      ),
    },
    { title: '更新时间', dataIndex: 'updated_at', width: 160, render: (v: string) => fmtTime(v) },
    {
      title: '操作',
      key: 'actions',
      width: 170,
      render: (_, r) => (
        <Space size={0}>
          <Button type="link" size="small" onClick={() => navigate(`/admin/products/${r.id}/edit`)}>
            编辑
          </Button>
          <Button type="link" size="small" onClick={() => void duplicate(r)}>
            复制
          </Button>
          <Popconfirm
            title={`删除「${r.name}」？`}
            description="询价中的产品快照会保留"
            okText="删除"
            okButtonProps={{ danger: true }}
            cancelText="取消"
            onConfirm={() => void remove(r)}
          >
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const onPageChange = (p: number, ps: number): void => {
    setPage(p)
    setPageSize(ps)
  }

  const pagination: TablePaginationConfig = {
    current: page,
    pageSize,
    total,
    showSizeChanger: true,
    showTotal: (t) => `共 ${t} 个产品`,
    onChange: onPageChange,
  }

  return (
    <div>
      <PageHeader
        title="产品管理"
        description="含草稿与已归档；公开站仅展示已发布产品"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/admin/products/new')}>
            新建产品
          </Button>
        }
      />
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Input.Search
            placeholder="搜索名称 / SKU"
            allowClear
            style={{ width: 240 }}
            onSearch={(v) => {
              setQ(v)
              setPage(1)
            }}
          />
          <Select
            placeholder="分类"
            allowClear
            style={{ width: 180 }}
            value={categoryId}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            onChange={(v) => {
              setCategoryId(v)
              setPage(1)
            }}
          />
          <Select
            placeholder="状态"
            allowClear
            style={{ width: 130 }}
            value={status}
            options={[
              { value: 'draft', label: '草稿' },
              { value: 'published', label: '已发布' },
              { value: 'archived', label: '已归档' },
            ]}
            onChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
          />
        </Space>
        <Table rowKey="id" columns={columns} dataSource={list} loading={loading} pagination={pagination} />
      </Card>
    </div>
  )
}
