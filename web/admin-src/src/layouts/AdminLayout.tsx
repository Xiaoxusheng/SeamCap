import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Badge, Drawer, Dropdown, Tooltip } from 'antd'
import type { MenuProps } from 'antd'
import {
  AppstoreOutlined,
  AuditOutlined,
  BellOutlined,
  CloseOutlined,
  DashboardOutlined,
  DesktopOutlined,
  DownOutlined,
  FileTextOutlined,
  HomeOutlined,
  LogoutOutlined,
  MailOutlined,
  MenuFoldOutlined,
  MenuOutlined,
  MenuUnfoldOutlined,
  MoonOutlined,
  PictureOutlined,
  RightOutlined,
  SearchOutlined,
  SettingOutlined,
  SunOutlined,
  TagsOutlined,
  ToolOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { ThemeMode } from '../context/ThemeContext'
import { get } from '../api/client'
import type { DashboardData } from '../api/types'
import ChangePasswordModal from '../components/ChangePasswordModal'
import BrandMark from '../components/BrandMark'
import GlobalSearch from '../components/GlobalSearch'
import QuickNav from '../components/QuickNav'

interface NavItem {
  path: string
  label: string
  icon: ReactNode
}

interface NavGroup {
  key: string
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    key: 'workbench',
    label: '工作台',
    items: [{ path: '/admin/', label: '仪表盘', icon: <DashboardOutlined /> }],
  },
  {
    key: 'products',
    label: '产品中心',
    items: [
      { path: '/admin/products', label: '产品管理', icon: <AppstoreOutlined /> },
      { path: '/admin/categories', label: '分类管理', icon: <TagsOutlined /> },
    ],
  },
  {
    key: 'content',
    label: '素材与工艺',
    items: [
      { path: '/admin/media', label: '媒体库', icon: <PictureOutlined /> },
      { path: '/admin/craftsmanship', label: '工艺管理', icon: <ToolOutlined /> },
    ],
  },
  {
    key: 'web',
    label: '网站内容',
    items: [
      { path: '/admin/home', label: '首页内容', icon: <HomeOutlined /> },
      { path: '/admin/pages', label: '页面管理', icon: <FileTextOutlined /> },
    ],
  },
  {
    key: 'inquiries',
    label: '客户询价',
    items: [{ path: '/admin/inquiries', label: '询价管理', icon: <MailOutlined /> }],
  },
  {
    key: 'system',
    label: '系统管理',
    items: [
      { path: '/admin/settings', label: '站点设置', icon: <SettingOutlined /> },
      { path: '/admin/audit-logs', label: '审计日志', icon: <AuditOutlined /> },
    ],
  },
]

const COLLAPSE_KEY = 'seamcap.admin.sidebar.collapsed'
const GROUPS_KEY = 'seamcap.admin.sidebar.closed-groups'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

function readClosedGroups(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(GROUPS_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, boolean>
  } catch {
    return {}
  }
}

function isActivePath(pathname: string, path: string): boolean {
  if (path === '/admin/') return pathname === '/admin' || pathname === '/admin/'
  return pathname === path || pathname.startsWith(path + '/')
}

interface Crumb {
  label: string
  to?: string
}

const CRUMB_ROOT: Crumb = { label: '管理后台', to: '/admin/' }

// 顶栏面包屑只表达模块层级，不重复页面标题
function resolveCrumbs(pathname: string): Crumb[] {
  const path = pathname.replace(/\/+$/, '')
  if (path === '/admin') return [CRUMB_ROOT, { label: '仪表盘' }]

  if (path === '/admin/products/new') {
    return [
      CRUMB_ROOT,
      { label: '产品中心' },
      { label: '产品管理', to: '/admin/products' },
      { label: '新建' },
    ]
  }
  if (/^\/admin\/products\/\d+\/edit$/.test(path)) {
    return [
      CRUMB_ROOT,
      { label: '产品中心' },
      { label: '产品管理', to: '/admin/products' },
      { label: '编辑' },
    ]
  }
  if (path.startsWith('/admin/products') || path.startsWith('/admin/categories')) {
    return [CRUMB_ROOT, { label: '产品中心' }]
  }

  if (path === '/admin/craftsmanship/new' || /^\/admin\/craftsmanship\/\d+\/edit$/.test(path)) {
    return [
      CRUMB_ROOT,
      { label: '素材与工艺' },
      { label: '工艺管理', to: '/admin/craftsmanship' },
      { label: path.endsWith('/new') ? '新建' : '编辑' },
    ]
  }
  if (path.startsWith('/admin/craftsmanship') || path.startsWith('/admin/media')) {
    return [CRUMB_ROOT, { label: '素材与工艺' }]
  }

  if (/^\/admin\/pages\/[^/]+\/edit$/.test(path)) {
    return [
      CRUMB_ROOT,
      { label: '网站内容' },
      { label: '页面管理', to: '/admin/pages' },
      { label: '编辑' },
    ]
  }
  if (path.startsWith('/admin/pages') || path.startsWith('/admin/home')) {
    return [CRUMB_ROOT, { label: '网站内容' }]
  }

  if (path.startsWith('/admin/inquiries')) return [CRUMB_ROOT, { label: '客户询价' }]
  if (path.startsWith('/admin/settings') || path.startsWith('/admin/audit-logs')) {
    return [CRUMB_ROOT, { label: '系统管理' }]
  }
  return [CRUMB_ROOT]
}

export default function AdminLayout(): JSX.Element {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileSearch, setMobileSearch] = useState(false)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>(readClosedGroups)
  const [pwOpen, setPwOpen] = useState(false)
  const [newInquiries, setNewInquiries] = useState(0)
  const { admin, logout } = useAuth()
  const { mode, resolved, setMode } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    setMobileOpen(false)
    setMobileSearch(false)
  }, [location.pathname])

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
    } catch {
      // 隐私模式下忽略
    }
  }, [collapsed])

  useEffect(() => {
    try {
      localStorage.setItem(GROUPS_KEY, JSON.stringify(closedGroups))
    } catch {
      // 隐私模式下忽略
    }
  }, [closedGroups])

  useEffect(() => {
    let alive = true
    void get<DashboardData>('/admin/dashboard')
      .then(({ data }) => {
        if (alive) setNewInquiries(data.inquiries.new)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [location.pathname])

  const userMenu: MenuProps = {
    items: [
      {
        key: 'account',
        label: (
          <span className="sc-user-menu__account">当前账号 · {admin?.username ?? '—'}</span>
        ),
        disabled: true,
      },
      { type: 'divider' },
      { key: 'pw', icon: <UserOutlined />, label: '修改密码' },
      { type: 'divider' },
      { key: 'logout', danger: true, icon: <LogoutOutlined />, label: '退出登录' },
    ],
    onClick: ({ key }) => {
      if (key === 'pw') setPwOpen(true)
      if (key === 'logout') void logout().then(() => navigate('/admin/login', { replace: true }))
    },
  }

  const handleLogout = (): void => {
    void logout().then(() => navigate('/admin/login', { replace: true }))
  }

  // 主题菜单：浅色 / 深色 / 跟随系统，当前模式打勾并立即生效。
  const themeMenu: MenuProps = {
    selectable: true,
    selectedKeys: [mode],
    items: [
      { key: 'light', icon: <SunOutlined />, label: '浅色' },
      { key: 'dark', icon: <MoonOutlined />, label: '深色' },
      { key: 'system', icon: <DesktopOutlined />, label: '跟随系统' },
    ],
    onClick: ({ key }) => setMode(key as ThemeMode),
  }

  const themeLabel = mode === 'system' ? '跟随系统' : mode === 'dark' ? '深色' : '浅色'

  const crumbs = resolveCrumbs(location.pathname)

  const toggleGroup = (key: string): void => {
    setClosedGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const renderNav = (inDrawer = false): JSX.Element => (
    <nav className={inDrawer ? 'sc-drawer-nav__body' : 'sc-sidebar__nav'} aria-label="后台导航">
      {NAV_GROUPS.map((group) => {
        const collapsible = group.items.length > 1 && !inDrawer && !collapsed
        const closed = collapsible && closedGroups[group.key] === true
        return (
        <div className={`sc-nav-group${closed ? ' is-closed' : ''}`} key={group.key}>
          {collapsible ? (
            <button
              type="button"
              className="sc-nav-group__title"
              onClick={() => toggleGroup(group.key)}
              aria-expanded={!closed}
            >
              <span>{group.label}</span>
              {closed ? <RightOutlined /> : <DownOutlined />}
            </button>
          ) : (
            <div className="sc-nav-group__title">{group.label}</div>
          )}
          {!closed &&
            group.items.map((item) => {
            const active = isActivePath(location.pathname, item.path)
            const link = (
              <Link
                key={item.path}
                to={item.path}
                className={`sc-nav-link${active ? ' is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <span className="sc-nav-link__icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="sc-nav-link__label">{item.label}</span>
              </Link>
            )
            return !inDrawer && collapsed ? (
              <Tooltip key={item.path} title={item.label} placement="right" mouseEnterDelay={0.25}>
                {link}
              </Tooltip>
            ) : (
              link
            )
            })}
        </div>
        )
      })}
    </nav>
  )

  return (
    <div className={`sc-shell${collapsed ? ' is-collapsed' : ''}`}>
      <a className="sc-skip-link" href="#sc-main">
        跳到主要内容
      </a>

      <aside className="sc-sidebar" aria-label="侧边导航">
        <Link to="/admin/" className="sc-sidebar__brand" aria-label="SeamCap 管理后台首页">
          <BrandMark className="sc-sidebar__mark" size={32} />
          <span className="sc-sidebar__brand-text">
            <span className="sc-sidebar__brand-name">SeamCap</span>
            <span className="sc-sidebar__brand-sub">Admin Console</span>
          </span>
        </Link>

        {renderNav()}

        <div className="sc-sidebar__foot">
          <span className="sc-sidebar__version">SeamCap Console · v1</span>
        </div>
      </aside>

      <div className="sc-app">
        <header className="sc-topbar">
          <div className="sc-topbar__left">
            <button
              type="button"
              className="sc-icon-btn sc-topbar__menu"
              aria-label="打开导航菜单"
              onClick={() => setMobileOpen(true)}
            >
              <MenuOutlined />
            </button>
            <Tooltip title={collapsed ? '展开导航' : '收起导航'} placement="bottomLeft">
              <button
                type="button"
                className="sc-icon-btn sc-topbar__collapse"
                onClick={() => setCollapsed((v) => !v)}
                aria-label={collapsed ? '展开导航' : '收起导航'}
                aria-expanded={!collapsed}
              >
                {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              </button>
            </Tooltip>
            <Link to="/admin/" className="sc-topbar__brand-mobile" aria-label="SeamCap 工作台">
              <BrandMark size={24} />
              <span>SeamCap</span>
            </Link>
            <nav className="sc-breadcrumb" aria-label="面包屑">
              {crumbs.map((crumb, index) => (
                <span className="sc-breadcrumb__item" key={`${crumb.label}-${index}`}>
                  {index > 0 && (
                    <span className="sc-breadcrumb__sep" aria-hidden="true">
                      /
                    </span>
                  )}
                  {crumb.to && index < crumbs.length - 1 ? (
                    <Link to={crumb.to} className="sc-breadcrumb__link">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      className={
                        index === crumbs.length - 1
                          ? 'sc-breadcrumb__current'
                          : 'sc-breadcrumb__text'
                      }
                    >
                      {crumb.label}
                    </span>
                  )}
                </span>
              ))}
            </nav>
          </div>

          <div className="sc-topbar__right">
            <div className="sc-topbar__search-slot">
              <GlobalSearch />
            </div>
            <button
              type="button"
              className="sc-icon-btn sc-topbar__search-trigger"
              aria-label="打开搜索"
              aria-expanded={mobileSearch}
              onClick={() => setMobileSearch((v) => !v)}
            >
              <SearchOutlined />
            </button>

            <Dropdown menu={themeMenu} trigger={['click']} placement="bottomRight">
              <button
                type="button"
                className="sc-icon-btn sc-topbar__theme"
                aria-label={`切换主题，当前${themeLabel}`}
                title={`主题：${themeLabel}`}
              >
                {resolved === 'dark' ? <MoonOutlined /> : <SunOutlined />}
              </button>
            </Dropdown>

            <Tooltip title={newInquiries > 0 ? `${newInquiries} 条新询价待跟进` : '暂无新询价'}>
              <button
                type="button"
                className="sc-icon-btn sc-topbar__notify"
                aria-label={`新询价 ${newInquiries} 条`}
                onClick={() => navigate('/admin/inquiries?status=new')}
              >
                <Badge count={newInquiries} size="small" overflowCount={99} offset={[-2, 2]}>
                  <BellOutlined />
                </Badge>
              </button>
            </Tooltip>

            <span className="sc-topbar__divider" aria-hidden="true" />

            <Dropdown menu={userMenu} trigger={['click']} placement="bottomRight">
              <button type="button" className="sc-user" aria-label="账户菜单">
                <span className="sc-user__avatar">
                  {admin?.username?.slice(0, 1).toUpperCase() || 'A'}
                </span>
                <span className="sc-user__meta">
                  <span className="sc-user__name">{admin?.username ?? '—'}</span>
                  <span className="sc-user__role">管理员</span>
                </span>
                <DownOutlined className="sc-user__caret" />
              </button>
            </Dropdown>
          </div>
        </header>

        {mobileSearch && (
          <div className="sc-topbar__search-mobile">
            <GlobalSearch autoFocus onNavigate={() => setMobileSearch(false)} />
            <button
              type="button"
              className="sc-icon-btn"
              aria-label="关闭搜索"
              onClick={() => setMobileSearch(false)}
            >
              <CloseOutlined />
            </button>
          </div>
        )}

        <main className="sc-main" id="sc-main">
          <div className="sc-workspace">
            <div className="sc-page" key={location.pathname}>
              <QuickNav />
              <Outlet />
            </div>
          </div>
        </main>

        <footer className="sc-footer">
          <span>SeamCap · Admin Console</span>
          <span aria-hidden="true">·</span>
          <span>会话仅存于 HttpOnly Cookie · 请勿在公共设备保持登录</span>
        </footer>
      </div>

      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        placement="left"
        width="min(324px, 92vw)"
        closable={false}
        styles={{ body: { padding: 0 } }}
        title={null}
      >
        <div className="sc-drawer-nav">
          <div className="sc-drawer-nav__head">
            <Link to="/admin/" className="sc-sidebar__brand" onClick={() => setMobileOpen(false)}>
              <BrandMark className="sc-sidebar__mark" size={32} />
              <span className="sc-sidebar__brand-text">
                <span className="sc-sidebar__brand-name">SeamCap</span>
                <span className="sc-sidebar__brand-sub">Admin Console</span>
              </span>
            </Link>
            <button
              type="button"
              className="sc-icon-btn"
              aria-label="关闭导航菜单"
              onClick={() => setMobileOpen(false)}
            >
              <CloseOutlined />
            </button>
          </div>

          {renderNav(true)}

          <div className="sc-drawer-nav__foot">
            <span className="sc-drawer-nav__user">当前账号 · {admin?.username ?? '—'}</span>
            <button
              type="button"
              className="sc-action-link"
              onClick={() => {
                setMobileOpen(false)
                setPwOpen(true)
              }}
            >
              修改密码
            </button>
            <button
              type="button"
              className="sc-action-link sc-action-link--muted"
              onClick={handleLogout}
            >
              退出登录
            </button>
          </div>
        </div>
      </Drawer>

      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  )
}
