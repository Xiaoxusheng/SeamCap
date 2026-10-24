import { useCallback, useEffect, useState } from 'react'
import { Button, Table, Tooltip } from 'antd'
import { AuditOutlined, ReloadOutlined } from '@ant-design/icons'
import { fmtTime, get } from '../../api/client'
import type { AuditRow } from '../../api/types'
import PageHeader from '../../components/PageHeader'
import PageError from '../../components/PageError'
import EmptyState from '../../components/EmptyState'
import TableSkeleton from '../../components/TableSkeleton'
import type { ColumnsType } from 'antd/es/table'

// 审计日志：只读、信息密集的最近 200 条记录
export default function AuditLogs(): JSX.Element {
  const [list, setList] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const { data } = await get<AuditRow[]>('/admin/audit-logs?limit=200')
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

  const columns: ColumnsType<AuditRow> = [
    {
      title: '时间',
      dataIndex: 'created_at',
      width: 152,
      render: (v: string) => <span className="sc-tabular sc-cell-secondary">{fmtTime(v)}</span>,
    },
    {
      title: '操作人',
      dataIndex: 'admin_username',
      width: 110,
      render: (v: string) => v || <span className="sc-cell-secondary">系统</span>,
    },
    {
      title: '动作',
      dataIndex: 'action',
      width: 180,
      render: (v: string) => <span className="sc-mono">{v}</span>,
    },
    {
      title: '实体',
      key: 'entity',
      width: 200,
      render: (_, r) =>
        r.entity_type ? (
          <span className="sc-mono">
            {r.entity_type}
            <span className="sc-muted">#{r.entity_id}</span>
          </span>
        ) : (
          <span className="sc-cell-secondary">—</span>
        ),
    },
    {
      title: '详情',
      dataIndex: 'detail',
      render: (v: string) =>
        v ? (
          <Tooltip title={v} placement="topLeft">
            <span className="sc-ellipsis sc-cell-secondary">{v}</span>
          </Tooltip>
        ) : (
          <span className="sc-cell-secondary">—</span>
        ),
    },
    {
      title: 'IP',
      dataIndex: 'ip',
      width: 130,
      render: (v: string) => <span className="sc-mono sc-cell-secondary">{v || '—'}</span>,
    },
  ]

  return (
    <div>
      <PageHeader
        title="审计日志"
        description="后台敏感操作记录，只读；保留最近 200 条。"
      />

      {error ? (
        <PageError message={error} onRetry={() => void load()} />
      ) : (
        <div className="sc-table-panel">
          <div className="sc-toolbar">
            <span className="sc-toolbar__meta">共 {list.length} 条记录 · 只读</span>
            <div className="sc-toolbar__spacer" />
            <Tooltip title="刷新日志">
              <Button
                type="text"
                className="sc-icon-btn"
                aria-label="刷新日志"
                icon={<ReloadOutlined />}
                loading={loading}
                onClick={() => void load()}
              />
            </Tooltip>
          </div>
          {loading && list.length === 0 ? (
            <TableSkeleton rows={10} columns={5} />
          ) : list.length === 0 ? (
            <EmptyState
              icon={<AuditOutlined />}
              title="暂无审计记录"
              description="后台的敏感操作会记录在这里。"
            />
          ) : (
            <Table
              className="sc-table"
              rowKey="id"
              columns={columns}
              dataSource={list}
              loading={loading}
              pagination={{
                defaultPageSize: 20,
                showSizeChanger: true,
                pageSizeOptions: ['20', '50', '100'],
                showTotal: (t) => `共 ${t} 条记录`,
                position: ['bottomRight'],
              }}
              scroll={{ x: 980 }}
            />
          )}
        </div>
      )}
    </div>
  )
}
