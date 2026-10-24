import { Skeleton } from 'antd'

// 页面级加载占位：与最终内容结构接近，避免整页转圈
export default function PageLoading({ rows = 8 }: { rows?: number }): JSX.Element {
  return (
    <div className="sc-loading-panel">
      <Skeleton active title paragraph={{ rows }} />
    </div>
  )
}
