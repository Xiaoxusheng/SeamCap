import { useMemo, useState } from 'react'
import { Breadcrumb, Dropdown, Layout, Menu, Typography } from 'antd'
import {
  AppstoreOutlined,
  AuditOutlined,
  DashboardOutlined,
  FileTextOutlined,
  HomeOutlined,
  MailOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PictureOutlined,
  SettingOutlined,
  TagsOutlined,
  ToolOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ChangePasswordModal from '../components/ChangePasswordModal'

const { Sider, Header, Content } = Layout

const MENU_ITEMS = [
  { key: '/admin/', icon: <DashboardOutlined />, label: '仪表盘' },
  { type: 'group' as const, label: '内容管理', children: [
    { key: '/admin/products', icon: <AppstoreOutlined />, label: '产品管理' },
    { key: '/admin/categories', icon: <TagsOutlined />, label: '分类管理' },
    { key: '/admin/media', icon: <PictureOutlined />, label: '媒体库' },
    { key: '/admin/craftsmanship', icon: <ToolOutlined />, label: '工艺管理' },
    { key: '/admin/pages', icon: <FileTextOutlined />, label: '页面管理' },
    { key: '/admin/home', icon: <HomeOutlined />, label: '首页内容' },
  ] },
  { type: 'group' as const, label: '客户与系统', children: [
    { key: '/admin/inquiries', icon: <MailOutlined />, label: '询价管理' },
    { key: '/admin/settings', icon: <SettingOutlined />, label: '站点设置' },
    { key: '/admin/audit-logs', icon: <AuditOutlined />, label: '审计日志' },
  ] },
]

const BREADCRUMB: Record<string, string> = {
  '': '仪表盘',
  products: '产品管理',
  categories: '分类管理',
  media: '媒体库',
  craftsmanship: '工艺管理',
  pages: '页面管理',
  home: '首页内容',
  settings: '站点设置',
  inquiries: '询价管理',
  'audit-logs': '审计日志',
}

function breadcrumbFor(pathname: string): string[] {
  const rest = pathname.replace(/^\/admin\/?/, '')
  if (rest === '') return ['仪表盘']
  const labels: string[] = [BREADCRUMB[rest.split('/')[0]] ?? 'SeamCap']
  if (rest.includes('/')) {
    if (rest.endsWith('/new')) labels.push('新建')
    else labels.push('编辑')
  }
  return labels
}

export default function AdminLayout(): JSX.Element {
  const [collapsed, setCollapsed] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const { admin, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const selectedKey = useMemo(() => {
    const rest = location.pathname.replace(/^\/admin\/?/, '')
    const section = rest.split('/')[0] ?? ''
    return '/admin/' + section
  }, [location.pathname])

  const userMenu = {
    items: [
      { key: 'pw', icon: <UserOutlined />, label: '修改密码' },
      { type: 'divider' as const },
      { key: 'logout', danger: true, label: '退出登录' },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === 'pw') setPwOpen(true)
      if (key === 'logout') void logout().then(() => navigate('/admin/login', { replace: true }))
    },
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        trigger={null}
        width={216}
        style={{ borderRight: '1px solid #E3E7ED' }}
      >
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            borderBottom: '1px solid #E3E7ED',
          }}
        >
          <span style={{ width: 26, height: 26, borderRadius: 6, background: '#0F172A', color: '#fff', fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>SC</span>
          {!collapsed && (
            <Typography.Text strong style={{ color: '#0F172A' }}>
              SeamCap
            </Typography.Text>
          )}
        </div>
        <Menu
          mode="inline"
          items={MENU_ITEMS}
          selectedKeys={[selectedKey]}
          style={{ borderInlineEnd: 'none', paddingTop: 8 }}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #E3E7ED',
            paddingInline: 16,
          }}
        >
          <span
            style={{ fontSize: 16, cursor: 'pointer', color: '#626C7B' }}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, paddingLeft: 12 }}>
            <Breadcrumb items={breadcrumbFor(location.pathname).map((t) => ({ title: t }))} />
          </div>
          <Dropdown menu={userMenu} placement="bottomRight">
            <span style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: '#EDF3FA',
                  color: '#0369A1',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <UserOutlined />
              </span>
              <Typography.Text>{admin?.username ?? '—'}</Typography.Text>
            </span>
          </Dropdown>
        </Header>
        <Content style={{ padding: 20 }}>
          <Outlet />
        </Content>
        <div style={{ textAlign: 'center', color: '#9299A5', fontSize: 12, padding: 16 }}>
          SeamCap Admin · 会话仅存于 HttpOnly Cookie · 请勿在公共设备保持登录
        </div>
      </Layout>
      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </Layout>
  )
}
