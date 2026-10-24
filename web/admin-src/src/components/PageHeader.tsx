import type { ReactNode } from 'react'

interface Props {
  title?: ReactNode
  description?: ReactNode
  extra?: ReactNode
  children?: ReactNode
  variant?: 'default' | 'editor'
  className?: string
}

// 页面标题区：大标题只出现一次，描述控制在一行内，操作按钮右对齐。
// 无标题且无操作时不渲染，避免产生空白占位。
export default function PageHeader({
  title,
  description,
  extra,
  children,
  variant = 'default',
  className,
}: Props): JSX.Element | null {
  const classes = [
    'sc-page-head',
    variant === 'editor' ? 'sc-page-head--editor' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  if (!title && !description && !extra && !children) return null

  return (
    <header className={classes}>
      {(title || description || children) && (
        <div className="sc-page-head__main">
          {title && <h1 className="sc-page-head__title">{title}</h1>}
          {description && <p className="sc-page-head__desc">{description}</p>}
          {children && <div className="sc-page-head__below">{children}</div>}
        </div>
      )}
      {extra && <div className="sc-page-head__actions">{extra}</div>}
    </header>
  )
}
