import { Button } from 'antd'
import { ReloadOutlined, WarningOutlined } from '@ant-design/icons'

// 统一请求失败态：说明发生了什么 + 提供真实重试
export default function PageError({
  message,
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}): JSX.Element {
  return (
    <div className="sc-error" role="alert">
      <WarningOutlined className="sc-error__icon" />
      <p className="sc-error__title">加载失败</p>
      <p className="sc-error__desc">{message || '请求未能完成'}。请检查网络连接后重试。</p>
      {onRetry && (
        <Button icon={<ReloadOutlined />} onClick={onRetry}>
          重新加载
        </Button>
      )}
    </div>
  )
}
