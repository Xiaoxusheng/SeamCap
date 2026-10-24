import { useCallback, useEffect, useState } from 'react'
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
  Tooltip,
} from 'antd'
import { PlusOutlined, ReloadOutlined, TagsOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { del, fmtTime, get, post, put } from '../../api/client'
import type { Category } from '../../api/types'
import MediaIDField from '../../components/MediaIDField'
import MediaThumb from '../../components/MediaThumb'
import PageHeader from '../../components/PageHeader'
import PageError from '../../components/PageError'
import { CategoryStatusTag } from '../../components/StatusTag'
import EmptyState from '../../components/EmptyState'
import TableSkeleton from '../../components/TableSkeleton'
import type { ColumnsType } from 'antd/es/table'

interface CatForm {
  name: string
  name_en?: string
  slug?: string
  description?: string
  image_id?: number | null
  sort_order?: number
  status: 'active' | 'inactive'
}

// 分类管理：目录表格 + CRUD + 删除三策略（409 → 迁移或停用）
export default function Categories(): JSX.Element {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [list, setList] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Category | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // 删除策略弹窗
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [deleteMode, setDeleteMode] = useState<'reassign' | 'archive'>('reassign')
  const [reassignTo, setReassignTo] = useState<number | undefined>(undefined)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const { data } = await get<Category[]>('/admin/categories')
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

  const openCreate = (): void => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ status: 'active', sort_order: 0 })
    setModalOpen(true)
  }

  const openEdit = (c: Category): void => {
    setEditing(c)
    form.setFieldsValue({
      name: c.name,
      name_en: c.name_en,
      slug: c.slug,
      description: c.description,
      image_id: c.image_id,
      sort_order: c.sort_order,
      status: c.status,
    })
    setModalOpen(true)
  }

  const save = async (): Promise<void> => {
    try {
      const values = (await form.validateFields()) as CatForm
      setSaving(true)
      const payload = {
        name: values.name,
        name_en: values.name_en ?? '',
        slug: values.slug ?? '',
        description: values.description ?? '',
        image_id: values.image_id ?? null,
        sort_order: values.sort_order ?? 0,
        status: values.status,
      }
      if (editing) await put(`/admin/categories/${editing.id}`, payload)
      else await post('/admin/categories', payload)
      message.success(editing ? '分类已更新' : '分类已创建')
      setModalOpen(false)
      void load()
    } catch (e) {
      const err = e as { fields?: Record<string, string>; message?: string }
      if (err.fields) {
        form.setFields(Object.entries(err.fields).map(([name, errors]) => ({ name, errors: [errors] })))
      } else if (err.message && err.message !== 'Validate failed') {
        message.error(err.message)
      }
    } finally {
      setSaving(false)
    }
  }

  const tryDelete = async (c: Category): Promise<void> => {
    try {
      await del(`/admin/categories/${c.id}`)
      message.success(`已删除分类「${c.name}」`)
      void load()
    } catch (e) {
      const err = e as { fields?: Record<string, string>; message?: string }
      if (err.fields?.product_count) {
        // 仍有产品关联 → 打开策略弹窗
        setDeleteTarget(c)
        setDeleteMode('reassign')
        setReassignTo(undefined)
      } else {
        message.error(err.message ?? '删除失败')
      }
    }
  }

  const confirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return
    if (deleteMode === 'reassign' && !reassignTo) {
      message.warning('请选择迁移目标分类')
      return
    }
    setDeleting(true)
    try {
      if (deleteMode === 'archive') {
        await del(`/admin/categories/${deleteTarget.id}?mode=archive`)
        message.success(`已停用「${deleteTarget.name}」（未删除）`)
      } else {
        const { data } = await del<{ deleted: boolean; reassigned: number }>(
          `/admin/categories/${deleteTarget.id}?mode=reassign&to=${reassignTo}`,
        )
        message.success(`已删除，${data.reassigned} 个产品已迁移`)
      }
      setDeleteTarget(null)
      void load()
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setDeleting(false)
    }
  }

  const columns: ColumnsType<Category> = [
    {
      title: '分类',
      dataIndex: 'name',
      ellipsis: true,
      render: (v: string, r) => (
        <div className="sc-entity">
          <MediaThumb media={r.image} alt={`${r.name} 分类封面`} />
          <div className="sc-entity__text">
            <div className="sc-entity__title">{v}</div>
            <div className="sc-entity__meta">{r.name_en || '未填写英文名'}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Slug',
      dataIndex: 'slug',
      width: 190,
      responsive: ['xl'],
      render: (v: string) =>
        v ? <span className="sc-code">{v}</span> : <span className="sc-cell-secondary">—</span>,
    },
    {
      title: '产品数',
      dataIndex: 'product_count',
      width: 94,
      align: 'right',
      responsive: ['md'],
      render: (v: number | undefined, r) =>
        v ? (
          <button
            type="button"
            className="sc-action-link"
            onClick={() => navigate(`/admin/products?category_id=${r.id}`)}
            aria-label={`查看「${r.name}」的 ${v} 个产品`}
          >
            {v}
          </button>
        ) : (
          <span className="sc-tabular sc-cell-secondary">0</span>
        ),
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      width: 72,
      align: 'right',
      responsive: ['lg'],
      render: (v: number) => <span className="sc-tabular sc-cell-secondary">{v}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 92,
      render: (v: Category['status']) => <CategoryStatusTag status={v} />,
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
      width: 116,
      align: 'right',
      render: (_, r) => (
        <div className="sc-cell-actions">
          <Button type="link" size="small" onClick={() => openEdit(r)}>
            编辑
          </Button>
          <Popconfirm
            title={`删除「${r.name}」？`}
            description={
              (r.product_count ?? 0) > 0
                ? `仍有 ${r.product_count} 个产品关联，将进入迁移 / 停用流程`
                : '该分类无关联产品'
            }
            okText="删除"
            okButtonProps={{ danger: true }}
            cancelText="取消"
            onConfirm={() => tryDelete(r)}
          >
            <Button type="text" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ]

  const activeCount = list.filter((c) => c.status === 'active').length
  const totalProducts = list.reduce((sum, c) => sum + (c.product_count ?? 0), 0)

  return (
    <div>
      <PageHeader
        title="分类管理"
        description="维护产品分类目录、封面与启用状态；删除含产品的分类时可选迁移或停用。"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建分类
          </Button>
        }
      />

      {error ? (
        <PageError message={error} onRetry={() => void load()} />
      ) : (
        <>
          <div className="sc-table-panel">
            <div className="sc-toolbar">
              <span className="sc-toolbar__meta">
                共 {list.length} 个分类 · {activeCount} 个启用 · {totalProducts} 个关联产品
              </span>
              <div className="sc-toolbar__spacer" />
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
              <TableSkeleton rows={6} columns={5} thumb />
            ) : list.length === 0 ? (
              <EmptyState
                icon={<TagsOutlined />}
                title="还没有分类"
                description="先创建一个分类，再将产品归类展示在公开站。"
                action={
                  <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                    新建分类
                  </Button>
                }
              />
            ) : (
              <Table
                className="sc-table sc-table--categories"
                rowKey="id"
                columns={columns}
                dataSource={list}
                loading={loading}
                pagination={false}
              />
            )}
          </div>
        </>
      )}

      <Modal
        title={editing ? `编辑分类：${editing.name}` : '新建分类'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void save()}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        width={580}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <div className="sc-form-grid">
            <Form.Item
              name="name"
              label="分类名称"
              rules={[{ required: true, message: '请输入分类名称' }, { max: 200 }]}
            >
              <Input placeholder="纯色系列" maxLength={200} />
            </Form.Item>
            <Form.Item name="name_en" label="英文名称" extra="留空时 slug 按中文名生成">
              <Input placeholder="Solid Color" maxLength={200} />
            </Form.Item>
            <Form.Item name="slug" label="Slug" className="sc-span-2" extra="留空自动生成">
              <Input placeholder="solid-color" maxLength={100} />
            </Form.Item>
            <Form.Item name="description" label="描述" className="sc-span-2">
              <Input.TextArea rows={3} maxLength={2000} />
            </Form.Item>
            <Form.Item name="image_id" label="封面图" className="sc-span-2">
              <MediaIDField />
            </Form.Item>
            <Form.Item name="sort_order" label="排序值">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Radio.Group>
                <Radio value="active">启用</Radio>
                <Radio value="inactive">停用</Radio>
              </Radio.Group>
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <Modal
        title={`删除「${deleteTarget?.name ?? ''}」`}
        open={deleteTarget != null}
        onCancel={() => setDeleteTarget(null)}
        onOk={() => void confirmDelete()}
        confirmLoading={deleting}
        okText={deleteMode === 'archive' ? '停用分类' : '迁移并删除'}
        cancelText="取消"
        width={500}
      >
        <p className="sc-helper" style={{ marginBottom: 12 }}>
          该分类仍有 {deleteTarget?.product_count ?? 0} 个产品关联，请选择处理方式。
        </p>
        <Radio.Group
          value={deleteMode}
          onChange={(e) => setDeleteMode(e.target.value as 'reassign' | 'archive')}
          style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}
        >
          <Radio value="reassign">迁移产品到其他分类，然后删除本分类</Radio>
          <Radio value="archive">仅停用本分类（不删除，保留产品关联）</Radio>
        </Radio.Group>
        {deleteMode === 'reassign' && (
          <Select
            placeholder="选择迁移目标分类"
            style={{ width: '100%' }}
            value={reassignTo}
            options={list
              .filter((c) => c.id !== deleteTarget?.id)
              .map((c) => ({ value: c.id, label: c.name }))}
            onChange={setReassignTo}
          />
        )}
      </Modal>
    </div>
  )
}
