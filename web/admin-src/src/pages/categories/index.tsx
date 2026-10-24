import { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Radio, Select, Space, Table } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { del, fmtTime, get, post, put } from '../../api/client'
import type { Category } from '../../api/types'
import MediaIDField from '../../components/MediaIDField'
import PageHeader from '../../components/PageHeader'
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

// 分类管理：CRUD + 删除三策略（409 → 迁移或停用）
export default function Categories(): JSX.Element {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [list, setList] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Category | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // 删除策略弹窗
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [deleteMode, setDeleteMode] = useState<'reassign' | 'archive'>('reassign')
  const [reassignTo, setReassignTo] = useState<number | undefined>(undefined)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const { data } = await get<Category[]>('/admin/categories')
      setList(data)
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [message])

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
    try {
      if (deleteMode === 'archive') {
        await del(`/admin/categories/${deleteTarget.id}?mode=archive`)
        message.success(`已停用「${deleteTarget.name}」（未删除）`)
      } else {
        if (!reassignTo) {
          message.warning('请选择迁移目标分类')
          return
        }
        const { data } = await del<{ deleted: boolean; reassigned: number }>(
          `/admin/categories/${deleteTarget.id}?mode=reassign&to=${reassignTo}`,
        )
        message.success(`已删除，${data.reassigned} 个产品已迁移`)
      }
      setDeleteTarget(null)
      void load()
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  const columns: ColumnsType<Category> = [
    {
      title: '封面',
      dataIndex: 'image',
      width: 64,
      render: (_, r) =>
        r.image ? (
          <img src={r.image.url} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />
        ) : (
          <span style={{ display: 'inline-block', width: 40, height: 40, borderRadius: 6, background: '#F1F3F6' }} />
        ),
    },
    { title: '名称', dataIndex: 'name', width: 180 },
    { title: '英文名', dataIndex: 'name_en', width: 160, render: (v: string) => v || '—' },
    { title: 'Slug', dataIndex: 'slug', width: 180, render: (v: string) => <Typography_Code v={v} /> },
    { title: '产品数', dataIndex: 'product_count', width: 90, render: (v?: number) => v ?? 0 },
    { title: '排序', dataIndex: 'sort_order', width: 70 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (v: Category['status']) =>
        v === 'active' ? <Button size="small" style={{ pointerEvents: 'none' }}>启用</Button> : <Button size="small" style={{ pointerEvents: 'none' }}>停用</Button>,
    },
    { title: '更新时间', dataIndex: 'updated_at', width: 160, render: (v: string) => fmtTime(v) },
    {
      title: '操作',
      key: 'actions',
      width: 130,
      render: (_, r) => (
        <Space size={0}>
          <Button type="link" size="small" onClick={() => openEdit(r)}>
            编辑
          </Button>
          <Popconfirm
            title={`删除「${r.name}」？`}
            description={(r.product_count ?? 0) > 0 ? `仍有 ${r.product_count} 个产品关联，将进入处理流程` : '该分类无关联产品'}
            okText="删除"
            okButtonProps={{ danger: true }}
            cancelText="取消"
            onConfirm={() => void tryDelete(r)}
          >
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="分类管理"
        description="公开站仅显示启用分类；删除含产品的分类时可选迁移或停用"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建分类
          </Button>
        }
      />
      <Card size="small">
        <Table rowKey="id" columns={columns} dataSource={list} loading={loading} pagination={false} />
      </Card>

      <Modal
        title={editing ? `编辑分类：${editing.name}` : '新建分类'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void save()}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        width={560}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Space wrap size={16}>
            <Form.Item name="name" label="分类名称 *" rules={[{ required: true, message: '请输入分类名称' }, { max: 200 }]} style={{ width: 220 }}>
              <Input placeholder="纯色系列" maxLength={200} />
            </Form.Item>
            <Form.Item name="name_en" label="英文名" style={{ width: 220 }} extra="留空时 slug 按中文名生成">
              <Input placeholder="Solid Color" maxLength={200} />
            </Form.Item>
          </Space>
          <Form.Item name="slug" label="Slug" extra="留空自动生成">
            <Input placeholder="solid-color" maxLength={100} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} maxLength={2000} />
          </Form.Item>
          <Form.Item name="image_id" label="封面图">
            <MediaIDField />
          </Form.Item>
          <Space wrap size={16}>
            <Form.Item name="sort_order" label="排序值" style={{ width: 140 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Radio.Group
                options={[
                  { value: 'active', label: '启用' },
                  { value: 'inactive', label: '停用' },
                ]}
                optionType="button"
              />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      <Modal
        title={`删除「${deleteTarget?.name ?? ''}」`}
        open={deleteTarget != null}
        onCancel={() => setDeleteTarget(null)}
        onOk={() => void confirmDelete()}
        okText={deleteMode === 'archive' ? '停用分类' : '迁移并删除'}
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%', margin: '8px 0' }}>
          <Radio.Group
            value={deleteMode}
            onChange={(e) => setDeleteMode(e.target.value as 'reassign' | 'archive')}
            options={[
              { value: 'reassign', label: `迁移 ${deleteTarget?.product_count ?? 0} 个产品到其他分类，然后删除本分类` },
              { value: 'archive', label: '仅停用本分类（不删除，产品保留关联）' },
            ]}
          />
          {deleteMode === 'reassign' && (
            <Select
              placeholder="选择迁移目标分类"
              style={{ width: '100%' }}
              value={reassignTo}
              options={list.filter((c) => c.id !== deleteTarget?.id).map((c) => ({ value: c.id, label: c.name }))}
              onChange={setReassignTo}
            />
          )}
        </Space>
      </Modal>
    </div>
  )
}

function Typography_Code({ v }: { v: string }): JSX.Element {
  return (
    <code style={{ fontSize: 12, background: '#F1F3F6', padding: '2px 6px', borderRadius: 4 }}>{v}</code>
  )
}
