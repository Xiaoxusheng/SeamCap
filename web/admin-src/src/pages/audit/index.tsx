import { useEffect, useState } from 'react'
import { App, Card, Table } from 'antd'
import { fmtTime, get } from '../../api/client'
import type { AuditRow } from '../../api/types'
import PageHeader from '../../components/PageHeader'
import type { ColumnsType } from 'antd/es/table'

// 审计日志：只读
export default function AuditLogs(): JSX.Element {
  const { message } = App.useApp()
  const [list, setList] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    get<AuditRow[]>('/admin/audit-logs?limit=200')
      .then(({ data }) => {
        if (alive) setList(data)
      })
      .catch((e: Error) => message.error(e.message))
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const columns: ColumnsType<AuditRow> = [
    { title: '时间', dataIndex: 'created_at', width: 160, render: (v: string) => fmtTime(v) },
    { title: '操作人', dataIndex: 'admin_username', width: 110, render: (v: string) => v || '系统' },
    { title: '动作', dataIndex: 'action', width: 170, render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code> },
    { title: '实体', key: 'entity', width: 200, render: (_, r) => (r.entity_type ? `${r.entity_type}#${r.entity_id}` : '—') },
    { title: '详情', dataIndex: 'detail', ellipsis: true, render: (v: string) => v || '—' },
    { title: 'IP', dataIndex: 'ip', width: 130, render: (v: string) => v || '—' },
  ]

  return (
    <div>
      <PageHeader title="审计日志" description="后台敏感操作记录（最近 200 条）" />
      <Card size="small">
        <Table rowKey="id" columns={columns} dataSource={list} loading={loading} pagination={false} size="small" />
      </Card>
    </div>
  )
}
