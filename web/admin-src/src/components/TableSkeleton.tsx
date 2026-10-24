interface Props {
  rows?: number
  columns?: number
  thumb?: boolean
}

// 表格行骨架：保持与真实表格相同的结构宽度
export default function TableSkeleton({ rows = 6, columns = 5, thumb = false }: Props): JSX.Element {
  return (
    <div aria-hidden="true">
      <div className="sc-table-skeleton__head">
        {Array.from({ length: columns }).map((_, i) => (
          <span
            className="sc-skeleton sc-table-skeleton__cell"
            key={i}
            style={{ maxWidth: i === 0 ? '34%' : undefined }}
          />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div className="sc-table-skeleton__row" key={r}>
          {thumb && <span className="sc-skeleton sc-table-skeleton__cell--thumb" />}
          {Array.from({ length: columns }).map((_, c) => (
            <span
              className="sc-skeleton sc-table-skeleton__cell"
              key={c}
              style={{ maxWidth: c === 0 ? '42%' : undefined }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
