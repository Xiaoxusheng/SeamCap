import { Segmented } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import { QUICK_NAV_ITEMS, activeNavKey } from '../navigation'

// 页面顶部快捷导航：antd Segmented 分段控制器（组件库原生样式，黑白灰配色）
export default function QuickNav(): JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()
  const active = activeNavKey(location.pathname)

  return (
    <div className="sc-quicknav" role="navigation" aria-label="快捷导航">
      <Segmented
        value={active}
        onChange={(value) => navigate(String(value))}
        options={QUICK_NAV_ITEMS.map((item) => ({ value: item.path, label: item.label }))}
      />
    </div>
  )
}
