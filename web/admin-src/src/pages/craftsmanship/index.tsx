import { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, Popconfirm, Space, Table } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { del, fmtTime, get } from '../../api/client'
import type { Craftsmanship } from '../../api/types'
import { CraftStatusTag } from '../../components/StatusTag'
import PageHeader from '../../components/PageHeader'
import type { ColumnsType } from 'antd/es/table'

// 工艺列表
export default function CraftList(): JSX.Element {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [list, setList] = useState<Craftsmanship[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const { data } = await get<Craftsmanship[]>('/admin/craftsmanship')
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

  const remove = async (c: Craftsmanship): Promise<void> => {
    try {
      await del(`/admin/craftsmanship/${c.id}`)
      message.success('工艺已删除')
      void load()
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  const columns: ColumnsType<Craftsmanship> = [
    {
      title: '封面',
      dataIndex: 'cover_image',
      width: 64,
      render: (_, r) =>
        r.cover_image ? (
          <img src={r.cover_image.url} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />
        ) : (
          <span style={{ display: 'inline-block', width: 40, height: 40, borderRadius: 6, background: '#F1F3F6' }} />
        ),
    },
    { title: '标题', dataIndex: 'title', ellipsis: true },
    { title: 'Slug', dataIndex: 'slug', width: 200, ellipsis: true },
    { title: '状态', dataIndex: 'status', width: 92, render: (v: string) => <CraftStatusTag status={v} /> },
    { title: '排序', dataIndex: 'sort_order', width: 70 },
    { title: '更新时间', dataIndex: 'updated_at', width: 160, render: (v: string) => fmtTime(v) },
    {
      title: '操作',
      key: 'actions',
      width: 130,
      render: (_, r) => (
        <Space size={0}>
          <Button type="link" size="small" onClick={() => navigate(`/admin/craftsmanship/${r.id}/edit`)}>
            编辑
          </Button>
          <Popconfirm title={`删除「${r.title}」？`} okText="删除" okButtonProps={{ danger: true }} cancelText="取消" onConfirm={() => void remove(r)}>
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
        title="工艺管理"
        description="展示工厂工艺能力的内容页（无痕工艺、模具、质检等）"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/admin/craftsmanship/new')}>
            新建工艺
          </Button>
        }
      />
      <Card size="small">
        <Table rowKey="id" columns={columns} dataSource={list} loading={loading} pagination={false} />
      </Card>
    </div>
  )
}
