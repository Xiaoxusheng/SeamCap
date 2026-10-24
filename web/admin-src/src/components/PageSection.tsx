import type { ReactNode } from 'react'

interface Props {
  id?: string
  title?: ReactNode
  description?: ReactNode
  extra?: ReactNode
  children: ReactNode
  className?: string
  compact?: boolean
  flush?: boolean
}

// 统一内容分区：白色表面 + 细边框，编辑页可放入 .sc-editor-sheet 内形成分隔段
export default function PageSection({
  id,
  title,
  description,
  extra,
  children,
  className,
  compact = false,
  flush = false,
}: Props): JSX.Element {
  const classes = [
    'sc-section',
    compact ? 'sc-section--compact' : '',
    flush ? 'sc-section--flush' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section className={classes} id={id}>
      {(title || description || extra) && (
        <header className="sc-section__head">
          <div>
            {title && <h2 className="sc-section__title">{title}</h2>}
            {description && <p className="sc-section__desc">{description}</p>}
          </div>
          {extra && <div className="sc-section__extra">{extra}</div>}
        </header>
      )}
      <div className="sc-section__body">{children}</div>
    </section>
  )
}
