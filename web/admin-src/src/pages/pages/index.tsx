import { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, Input, Modal, Space, Table } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { fmtTime, get, put } from '../../api/client'
import type { PageContent } from '../../api/types'
import PageHeader from '../../components/PageHeader'
import type { ColumnsType } from 'antd/es/table'

// 页面管理：列表 + 新建（PUT upsert 语义）
export default function PageList(): JSX.Element {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [list, setList] = useState<PageContent[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [newSlug, setNewSlug] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const { data } = await get<PageContent[]>('/admin/pages')
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

  const create = async (): Promise<void> => {
    const slug = newSlug.trim().toLowerCase()
    if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug)) {
      message.warning('Slug 仅允许小写字母/数字/连字符')
      return
    }
    setCreating(true)
    try {
      await put(`/admin/pages/${slug}`, { title: '未命名页面', body: '', status: 'draft' })
      message.success('页面已创建，请继续编辑')
      setCreateOpen(false)
      navigate(`/admin/pages/${slug}/edit`)
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const columns: ColumnsType<PageContent> = [
    { title: '标题', dataIndex: 'title', ellipsis: true },
    { title: 'Slug', dataIndex: 'slug', width: 220, render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code> },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => (v === 'published' ? '已发布' : '草稿'),
    },
    { title: '更新时间', dataIndex: 'updated_at', width: 160, render: (v: string) => fmtTime(v) },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_, r) => (
        <Button type="link" size="small" onClick={() => navigate(`/admin/pages/${r.slug}/edit`)}>
          编辑
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="页面管理"
        description="关于我们 / 隐私政策等普通页面（受控 HTML，服务端白名单过滤）"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            新建页面
          </Button>
        }
      />
      <Card size="small">
        <Table rowKey="id" columns={columns} dataSource={list} loading={loading} pagination={false} />
      </Card>
      <Modal
        title="新建页面"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => void create()}
        confirmLoading={creating}
        okText="创建草稿"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%', marginTop: 8 }}>
          <Input
            placeholder="页面 slug，如 shipping-guide"
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            onPressEnter={() => void create()}
          />
          <span style={{ color: '#9299A5', fontSize: 12 }}>
            仅小写字母/数字/连字符；创建后可在编辑页完善标题与内容
          </span>
        </Space>
      </Modal>
    </div>
  )
}
