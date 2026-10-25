// 快捷导航共享定义：顶栏快捷导航条与侧边栏保持同一套路径/命名
export interface QuickNavItem {
  path: string
  label: string
}

export const QUICK_NAV_ITEMS: QuickNavItem[] = [
  { path: '/admin/', label: '仪表盘' },
  { path: '/admin/products', label: '产品管理' },
  { path: '/admin/categories', label: '分类管理' },
  { path: '/admin/media', label: '媒体库' },
  { path: '/admin/craftsmanship', label: '工艺管理' },
  { path: '/admin/packing', label: '打包发货' },
  { path: '/admin/home', label: '首页内容' },
  { path: '/admin/pages', label: '页面管理' },
  { path: '/admin/inquiries', label: '询价管理' },
  { path: '/admin/settings', label: '站点设置' },
  { path: '/admin/audit-logs', label: '审计日志' },
]

// 由路径解析当前激活的导航键（/admin/products/3/edit → /admin/products）
export function activeNavKey(pathname: string): string {
  const rest = pathname.replace(/^\/admin\/?/, '')
  const section = rest.split('/')[0] ?? ''
  return '/admin/' + section
}
