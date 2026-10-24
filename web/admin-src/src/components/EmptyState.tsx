import type { ReactNode } from 'react'
import { InboxOutlined } from '@ant-design/icons'

interface Props {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  bare?: boolean
  className?: string
}

// 统一空状态：线性图标 + 标题 + 说明 + 真实下一步
export default function EmptyState({
  icon,
  title,
  description,
  action,
  bare = false,
  className,
}: Props): JSX.Element {
  return (
    <div className={`sc-empty${bare ? ' sc-empty--bare' : ''}${className ? ` ${className}` : ''}`}>
      <span className="sc-empty__icon" aria-hidden="true">
        {icon ?? <InboxOutlined />}
      </span>
      <p className="sc-empty__title">{title}</p>
      {description && <p className="sc-empty__desc">{description}</p>}
      {action && <div className="sc-empty__action">{action}</div>}
    </div>
  )
}
