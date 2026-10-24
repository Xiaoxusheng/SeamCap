import { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, DatePicker, Descriptions, Drawer, Empty, Input, Popconfirm, Select, Space, Spin, Table, Timeline } from 'antd'
import { DownloadOutlined, RedoOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useSearchParams } from 'react-router-dom'
import { del, fmtTime, get, post, put } from '../../api/client'
import type { Inquiry, InquiryEvent, InquiryStatus } from '../../api/types'
import { InquiryStatusTag, NotifyStatusTag } from '../../components/StatusTag'
import PageHeader from '../../components/PageHeader'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'

// 询价管理：筛选/导出/详情抽屉（状态流转 + 备注 + 事件时间线 + 重发通知）
export default function Inquiries(): JSX.Element {
  const { message } = App.useApp()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<InquiryStatus | undefined>(undefined)
  const [range, setRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [list, setList] = useState<Inquiry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const [detail, setDetail] = useState<Inquiry | null>(null)
  const [events, setEvents] = useState<InquiryEvent[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  // URL 参数初始化（仪表盘跳转 ?status=new）
  const [searchParams] = useSearchParams()
  useEffect(() => {
    const s = searchParams.get('status') as InquiryStatus | null
    if (s) setStatus(s)
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
    try {
      const { data, pagination } = await get<Inquiry[]>('/admin/inquiries?' + buildParams())
      setList(data)
      setTotal(pagination?.total ?? 0)
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [buildParams, message])

  useEffect(() => {
    void load()
  }, [load])

  const openDetail = async (inq: Inquiry): Promise<void> => {
    setDetail(inq)
    setEvents([])
    setNote(inq.internal_note)
    setDetailLoading(true)
    try {
      const { data } = await get<{ inquiry: Inquiry; events: InquiryEvent[] }>(`/admin/inquiries/${inq.id}`)
      setDetail(data.inquiry)
      setEvents(data.events)
      setNote(data.inquiry.internal_note)
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setDetailLoading(false)
    }
  }

  const updateInquiry = async (patch: { status?: InquiryStatus; internal_note?: string }): Promise<void> => {
    if (!detail) return
    setSaving(true)
    try {
      const { data } = await put<Inquiry>(`/admin/inquiries/${detail.id}`, patch)
      setDetail(data)
      message.success('已保存')
      // 刷新事件时间线
      const { data: d2 } = await get<{ inquiry: Inquiry; events: InquiryEvent[] }>(`/admin/inquiries/${detail.id}`)
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
    try {
      await post(`/admin/inquiries/${detail.id}/resend-notify`)
      message.success('邮件已重新发送')
      const { data } = await get<{ inquiry: Inquiry; events: InquiryEvent[] }>(`/admin/inquiries/${detail.id}`)
      setDetail(data.inquiry)
      setEvents(data.events)
      void load()
    } catch (e) {
      message.error('重发失败：' + (e as Error).message)
    }
  }

  const remove = async (inq: Inquiry): Promise<void> => {
    try {
      await del(`/admin/inquiries/${inq.id}`)
      message.success('询价已删除')
      setDetail(null)
      void load()
    } catch (e) {
      message.error((e as Error).message)
    }
  }

  const exportCSV = (): void => {
    window.open('/api/v1/admin/inquiries/export?' + buildParams(), '_blank')
  }

  const columns: ColumnsType<Inquiry> = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '客户',
      dataIndex: 'name',
      width: 180,
      render: (_, r) => (
        <div>
          <div>{r.name}</div>
          {r.company && <div style={{ fontSize: 12, color: '#9299A5' }}>{r.company}</div>}
        </div>
      ),
    },
    { title: '邮箱', dataIndex: 'email', width: 190, ellipsis: true },
    { title: 'WhatsApp/电话', dataIndex: 'whatsapp_phone', width: 150, ellipsis: true, render: (v: string) => v || '—' },
    {
      title: '产品',
      dataIndex: 'product_name_snapshot',
      width: 170,
      ellipsis: true,
      render: (v: string, r) =>
        v ? (
          <div>
            <div style={{ fontSize: 13 }}>{v}</div>
            {r.product_sku_snapshot && <div style={{ fontSize: 11, color: '#9299A5' }}>{r.product_sku_snapshot}</div>}
          </div>
        ) : (
          <span style={{ color: '#9299A5' }}>—</span>
        ),
    },
    { title: '状态', dataIndex: 'status', width: 92, render: (v: InquiryStatus) => <InquiryStatusTag status={v} /> },
    { title: '邮件', dataIndex: 'email_notify_status', width: 88, render: (v: string) => <NotifyStatusTag status={v} /> },
    { title: '时间', dataIndex: 'created_at', width: 150, render: (v: string) => fmtTime(v) },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_, r) => (
        <Button type="link" size="small" onClick={() => void openDetail(r)}>
          详情
        </Button>
      ),
    },
  ]

  const pagination: TablePaginationConfig = {
    current: page,
    pageSize,
    total,
    showSizeChanger: true,
    showTotal: (t) => `共 ${t} 条`,
    onChange: (p, ps) => {
      setPage(p)
      setPageSize(ps)
    },
  }

  const eventColor = (t: string): string => {
    switch (t) {
      case 'created':
        return 'blue'
      case 'status_changed':
        return 'green'
      case 'note':
        return 'gray'
      case 'notify':
        return 'gold'
      default:
        return 'gray'
    }
  }

  const eventLabel = (e: InquiryEvent): string => {
    switch (e.event_type) {
      case 'created':
        return '询价提交'
      case 'status_changed':
        return `状态：${e.from_status || '—'} → ${e.to_status || '—'}`
      case 'note':
        return '内部备注'
      case 'notify':
        return '邮件通知'
      default:
        return e.event_type
    }
  }

  return (
    <div>
      <PageHeader
        title="询价管理"
        description="客户线索收集与跟进；删除询价将一并删除事件历史"
        extra={
          <Button icon={<DownloadOutlined />} onClick={exportCSV}>
            导出 CSV
          </Button>
        }
      />
      <Card size="small">
        <Space wrap style={{ marginBottom: 12 }}>
          <Input.Search
            placeholder="搜索姓名/公司/邮箱/产品"
            allowClear
            style={{ width: 250 }}
            onSearch={(v) => {
              setQ(v)
              setPage(1)
            }}
          />
          <Select
            placeholder="状态"
            allowClear
            style={{ width: 140 }}
            value={status}
            options={[
              { value: 'new', label: '新询价' },
              { value: 'following', label: '跟进中' },
              { value: 'replied', label: '已回复' },
              { value: 'completed', label: '已完成' },
              { value: 'spam', label: '垃圾' },
            ]}
            onChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
          />
          <DatePicker.RangePicker
            value={range}
            onChange={(v) => {
              setRange(v)
              setPage(1)
            }}
          />
        </Space>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={list}
          loading={loading}
          pagination={pagination}
          locale={{ emptyText: <Empty description="暂无询价" /> }}
        />
      </Card>

      <Drawer
        title={`询价 #${detail?.id ?? ''}`}
        open={detail != null}
        width={640}
        onClose={() => setDetail(null)}
        destroyOnHidden
        extra={
          detail && (
            <Popconfirm title="确认删除该询价？" description="事件历史将一并删除" okText="删除" okButtonProps={{ danger: true }} cancelText="取消" onConfirm={() => void remove(detail)}>
              <Button danger size="small">
                删除
              </Button>
            </Popconfirm>
          )
        }
      >
        {detailLoading || !detail ? (
          <Spin />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="姓名">{detail.name}</Descriptions.Item>
              <Descriptions.Item label="公司">{detail.company || '—'}</Descriptions.Item>
              <Descriptions.Item label="邮箱">{detail.email}</Descriptions.Item>
              <Descriptions.Item label="WhatsApp/电话">{detail.whatsapp_phone || '—'}</Descriptions.Item>
              <Descriptions.Item label="产品" span={2}>
                {detail.product_name_snapshot
                  ? `${detail.product_name_snapshot}${detail.product_sku_snapshot ? `（${detail.product_sku_snapshot}）` : ''}`
                  : '产品已删除或未关联'}
              </Descriptions.Item>
              <Descriptions.Item label="预估数量">{detail.estimated_qty || '—'}</Descriptions.Item>
              <Descriptions.Item label="定制要求">{detail.customization || '—'}</Descriptions.Item>
              <Descriptions.Item label="来源页">{detail.source_page || '—'}</Descriptions.Item>
              <Descriptions.Item label="提交时间">{fmtTime(detail.created_at)}</Descriptions.Item>
              <Descriptions.Item label="IP">{detail.ip || '—'}</Descriptions.Item>
              <Descriptions.Item label="邮件通知">
                <NotifyStatusTag status={detail.email_notify_status} />
                {(detail.email_notify_status === 'pending' || detail.email_notify_status === 'failed') && (
                  <Button size="small" icon={<RedoOutlined />} style={{ marginLeft: 8 }} onClick={() => void resend()}>
                    重发
                  </Button>
                )}
              </Descriptions.Item>
            </Descriptions>

            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>客户留言</div>
              <div style={{ whiteSpace: 'pre-wrap', background: '#F6F7F9', border: '1px solid #E3E7ED', borderRadius: 8, padding: 12, fontSize: 13 }}>
                {detail.message}
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>状态与备注</div>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Select
                  value={detail.status}
                  style={{ width: 200 }}
                  onChange={(v: InquiryStatus) => void updateInquiry({ status: v })}
                  options={[
                    { value: 'new', label: '新询价' },
                    { value: 'following', label: '跟进中' },
                    { value: 'replied', label: '已回复' },
                    { value: 'completed', label: '已完成' },
                    { value: 'spam', label: '垃圾' },
                  ]}
                />
                <Input.TextArea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="内部备注（客户不会看到）" maxLength={5000} />
                <Button
                  type="primary"
                  size="small"
                  loading={saving}
                  onClick={() => void updateInquiry({ internal_note: note })}
                  disabled={note === detail.internal_note}
                >
                  保存备注
                </Button>
              </Space>
            </div>

            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>事件历史</div>
              {events.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <Timeline
                  items={events.map((e) => ({
                    color: eventColor(e.event_type),
                    children: (
                      <div>
                        <div style={{ fontSize: 13 }}>{eventLabel(e)}</div>
                        {e.detail && <div style={{ fontSize: 12, color: '#626C7B', whiteSpace: 'pre-wrap' }}>{e.detail}</div>}
                        <div style={{ fontSize: 11, color: '#9299A5' }}>{fmtTime(e.created_at)}</div>
                      </div>
                    ),
                  }))}
                />
              )}
            </div>
          </Space>
        )}
      </Drawer>
    </div>
  )
}
