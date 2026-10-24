import { Card, Typography } from 'antd'
import type { ReactNode } from 'react'

// 页头：标题 + 描述 + 主操作区
export default function PageHeader(props: {
  title: string
  description?: string
  extra?: ReactNode
  children?: ReactNode
}): JSX.Element {
  return (
    <Card style={{ marginBottom: 16 }} styles={{ body: { padding: '16px 20px' } }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0, color: '#0F172A' }}>
            {props.title}
          </Typography.Title>
          {props.description && (
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              {props.description}
            </Typography.Text>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>{props.extra}</div>
      </div>
      {props.children}
    </Card>
  )
}
