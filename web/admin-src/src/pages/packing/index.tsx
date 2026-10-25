import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Table,
  Tag,
  Tooltip,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  InboxOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { del, fmtTime, get, post, put } from '../../api/client'
import type { Media, PackingCategory, PackingItem, PackingStatus } from '../../api/types'
import MediaIDField from '../../components/MediaIDField'
import MediaPicker from '../../components/MediaPicker'
import MediaThumb from '../../components/MediaThumb'
import PageHeader from '../../components/PageHeader'
import PageError from '../../components/PageError'
import EmptyState from '../../components/EmptyState'
import TableSkeleton from '../../components/TableSkeleton'

const CATEGORY_OPTIONS: { value: PackingCategory; label: string; color: string }[] = [
  { value: 'packing', label: '打包 Packing', color: 'gold' },
  { value: 'loading', label: '装车 Loading', color: 'blue' },
  { value: 'warehouse', label: '仓储 Warehouse', color: 'default' },
]

function categoryMeta(key: PackingCategory): { label: string; color: string } {
  return CATEGORY_OPTIONS.find((o) => o.value === key) ?? CATEGORY_OPTIONS[0]
}

interface FormValues {
  media_id: number | null
  category: PackingCategory
  title: string
  caption: string
  sort_order: number
  status: PackingStatus
}

// 打包发货素材库：前台 Packing & Dispatch 图库的内容源
export default function PackingPage(): JSX.Element {
  const { message } = App.useApp()
  const [form] = Form.useForm<FormValues>()
  const [list, setList] = useState<PackingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<PackingItem | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [batchOpen, setBatchOpen] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const { data } = await get<PackingItem[]>('/admin/packing')
      setList(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const stats = useMemo(() => {
    const published = list.filter((i) => i.status === 'published').length
    return { total: list.length, published, hidden: list.length - published }
  }, [list])

  const openCreate = (): void => {
    setEditing(null)
    form.setFieldsValue({
      media_id: null,
      category: 'packing',
      title: '',
      caption: '',
      sort_order: (list[list.length - 1]?.sort_order ?? 0) + 1,
      status: 'published',
    })
    setModalOpen(true)
  }

  const openEdit = (item: PackingItem): void => {
    setEditing(item)
    form.setFieldsValue({
      media_id: item.media_id,
      category: item.category,
      title: item.title,
      caption: item.caption,
      sort_order: item.sort_order,
      status: item.status,
    })
    setModalOpen(true)
  }

  const submit = async (): Promise<void> => {
    try {
      const values = await form.validateFields()
      if (!values.media_id) {
        message.warning('请选择素材（图片或视频）')
        return
      }
      setSaving(true)
      const payload = {
        media_id: values.media_id,
        category: values.category,
        title: values.title ?? '',
        caption: values.caption ?? '',
        sort_order: values.sort_order ?? 0,
        status: values.status,
      }
      if (editing) {
        await put(`/admin/packing/${editing.id}`, payload)
        message.success('素材已更新')
      } else {
        await post('/admin/packing', payload)
        message.success('素材已添加')
      }
      setModalOpen(false)
      await load()
    } catch (e) {
      if (e instanceof Error && e.message !== 'Validate failed') message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  // 批量添加：批量选择媒体，逐个建立条目（分类默认打包，追加到末尾）
  const batchAdd = async (items: Media[]): Promise<void> => {
    setBatchOpen(false)
    if (items.length === 0) return
    const base = (list[list.length - 1]?.sort_order ?? 0) + 1
    let ok = 0
    for (let i = 0; i < items.length; i += 1) {
      try {
        await post('/admin/packing', {
          media_id: items[i].id,
          category: 'packing',
          title: '',
          caption: '',
          sort_order: base + i,
          status: 'published',
        })
        ok += 1
      } catch (e) {
        message.error(`${items[i].original_name} 添加失败：${(e as Error).message}`)
      }
    }
    if (ok > 0) message.success(`已添加 ${ok} 个素材，可在列表里补充文案与分类`)
    await load()
  }

  const remove = async (item: PackingItem): Promise<void> => {
    setBusyId(item.id)
    try {
      await del(`/admin/packing/${item.id}`)
      message.success('素材已删除')
      await load()
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  // 上移/下移：与相邻条目交换排序值
  const move = async (index: number, dir: -1 | 1): Promise<void> => {
    const target = index + dir
    if (target < 0 || target >= list.length) return
    const a = list[index]
    const b = list[target]
    setBusyId(a.id)
    try {
      const payload = (it: PackingItem, sort: number) => ({
        media_id: it.media_id,
        category: it.category,
        title: it.title,
        caption: it.caption,
        sort_order: sort,
        status: it.status,
      })
      await put(`/admin/packing/${a.id}`, payload(a, b.sort_order))
      await put(`/admin/packing/${b.id}`, payload(b, a.sort_order))
      await load()
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  const columns: ColumnsType<PackingItem> = [
    {
      title: '预览',
      dataIndex: 'media',
      width: 92,
      render: (_, row) => <MediaThumb media={row.media} alt={row.title || undefined} large />,
    },
    {
      title: '文案',
      dataIndex: 'title',
      render: (_, row) => (
        <div className="sc-entity">
          <div className="sc-entity__text">
            <div className="sc-entity__title">
              {row.title || <span className="sc-cell-secondary">未填写标题</span>}
            </div>
            {row.caption ? <div className="sc-entity__meta">{row.caption}</div> : null}
          </div>
        </div>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 150,
      filters: CATEGORY_OPTIONS.map((o) => ({ text: o.label, value: o.value })),
      onFilter: (value, row) => row.category === value,
      render: (v: PackingCategory) => {
        const meta = categoryMeta(v)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      width: 130,
      sorter: (a, b) => a.sort_order - b.sort_order,
      render: (_, row) => {
        const index = list.findIndex((i) => i.id === row.id)
        return (
          <div className="sc-packing-order">
            <span className="sc-tabular">{row.sort_order}</span>
            <Tooltip title="上移">
              <Button
                size="small"
                type="text"
                aria-label="上移"
                disabled={index <= 0 || busyId === row.id}
                icon={<ArrowUpOutlined />}
                onClick={() => void move(index, -1)}
              />
            </Tooltip>
            <Tooltip title="下移">
              <Button
                size="small"
                type="text"
                aria-label="下移"
                disabled={index >= list.length - 1 || busyId === row.id}
                icon={<ArrowDownOutlined />}
                onClick={() => void move(index, 1)}
              />
            </Tooltip>
          </div>
        )
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: PackingStatus) =>
        v === 'published' ? <Tag color="success">已发布</Tag> : <Tag>已隐藏</Tag>,
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 170,
      render: (v: string) => <span className="sc-tabular">{fmtTime(v)}</span>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 130,
      fixed: 'right',
      render: (_, row) => (
        <div className="sc-cell-actions">
          <Button size="small" onClick={() => openEdit(row)}>
            编辑
          </Button>
          <Popconfirm
            title="删除这条素材？"
            description="仅从打包发货图库移除，媒体文件仍保留在媒体库"
            okText="删除"
            okButtonProps={{ danger: true }}
            cancelText="取消"
            onConfirm={() => remove(row)}
          >
            <Button size="small" danger loading={busyId === row.id}>
              删除
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="打包发货"
        description="前台「Packing & Dispatch」图库的内容源：打包、装车、仓储实拍图与视频，可按分类筛选并排序。"
        extra={
          <>
            <span className="sc-toolbar__meta">
              共 {stats.total} 条 · 已发布 {stats.published} · 已隐藏 {stats.hidden}
            </span>
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
            <Button icon={<InboxOutlined />} onClick={() => setBatchOpen(true)}>
              批量添加
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              添加素材
            </Button>
          </>
        }
      />

      {error ? (
        <PageError message={error} onRetry={() => void load()} />
      ) : loading && list.length === 0 ? (
        <TableSkeleton rows={6} />
      ) : list.length === 0 ? (
        <EmptyState
          className="sc-panel"
          icon={<InboxOutlined />}
          title="还没有打包发货素材"
          description="上传打包、装车、仓储的实拍图或短视频，前台图库会自动同步。"
          action={
            <div className="sc-cell-actions">
              <Button icon={<InboxOutlined />} onClick={() => setBatchOpen(true)}>
                批量添加
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                添加素材
              </Button>
            </div>
          }
        />
      ) : (
        <div className="sc-panel sc-panel--flush">
          <Table<PackingItem>
            rowKey="id"
            size="middle"
            columns={columns}
            dataSource={list}
            pagination={false}
            scroll={{ x: 940 }}
          />
        </div>
      )}

      <Modal
        title={editing ? '编辑素材' : '添加素材'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void submit()}
        okText={editing ? '保存' : '添加'}
        cancelText="取消"
        confirmLoading={saving}
        destroyOnHidden
        width={620}
      >
        <Form form={form} layout="vertical" initialValues={{ category: 'packing', status: 'published' }}>
          <Form.Item label="素材（图片或视频）" required style={{ marginBottom: 18 }}>
            <Form.Item name="media_id" noStyle rules={[{ required: true, message: '请选择素材' }]}>
              <MediaIDField />
            </Form.Item>
          </Form.Item>
          <div className="sc-form-grid">
            <Form.Item name="category" label="分类" rules={[{ required: true }]}>
              <Select options={CATEGORY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
            </Form.Item>
            <Form.Item name="sort_order" label="排序值" extra="数值越小越靠前">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="title" label="标题" className="sc-span-2" rules={[{ max: 200 }]}>
              <Input placeholder="例如：50 pcs / carton, hand-marked sizes" maxLength={200} />
            </Form.Item>
            <Form.Item name="caption" label="说明" className="sc-span-2" rules={[{ max: 500 }]}>
              <Input.TextArea rows={3} maxLength={500} placeholder="一句话说明这张图在做什么（可选）" />
            </Form.Item>
            <Form.Item name="status" label="状态" className="sc-span-2" style={{ marginBottom: 0 }}>
              <Radio.Group>
                <Radio value="published">发布</Radio>
                <Radio value="hidden">隐藏</Radio>
              </Radio.Group>
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <MediaPicker
        open={batchOpen}
        multiple
        onCancel={() => setBatchOpen(false)}
        onOk={(items) => void batchAdd(items)}
      />

      {list.length > 0 && (
        <p className="sc-helper" style={{ marginTop: 12 }}>
          删除只移除图库条目，媒体文件仍保留在媒体库；前台按「排序值 → 新增顺序」展示。
        </p>
      )}
    </div>
  )
}
