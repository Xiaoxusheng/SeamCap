import { Navigate, Route, Routes } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuth } from './context/AuthContext'
import AdminLayout from './layouts/AdminLayout'
import Login from './pages/login'
import Dashboard from './pages/dashboard'
import ProductList from './pages/products'
import ProductEdit from './pages/products/edit'
import Categories from './pages/categories'
import MediaPage from './pages/media'
import CraftList from './pages/craftsmanship'
import CraftEdit from './pages/craftsmanship/edit'
import PageList from './pages/pages'
import PageEdit from './pages/pages/edit'
import HomePage from './pages/home'
import SettingsPage from './pages/settings'
import Inquiries from './pages/inquiries'
import AuditLogs from './pages/audit'

function RequireAuth({ children }: { children: JSX.Element }): JSX.Element {
  const { admin, ready } = useAuth()
  if (!ready) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 160 }}>
        <Spin size="large" />
      </div>
    )
  }
  if (!admin) return <Navigate to="/admin/login" replace />
  return children
}

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/admin/login" element={<Login />} />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="products" element={<ProductList />} />
        <Route path="products/new" element={<ProductEdit />} />
        <Route path="products/:id/edit" element={<ProductEdit />} />
        <Route path="categories" element={<Categories />} />
        <Route path="media" element={<MediaPage />} />
        <Route path="craftsmanship" element={<CraftList />} />
        <Route path="craftsmanship/new" element={<CraftEdit />} />
        <Route path="craftsmanship/:id/edit" element={<CraftEdit />} />
        <Route path="pages" element={<PageList />} />
        <Route path="pages/:slug/edit" element={<PageEdit />} />
        <Route path="home" element={<HomePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="inquiries" element={<Inquiries />} />
        <Route path="audit-logs" element={<AuditLogs />} />
      </Route>
      <Route path="*" element={<Navigate to="/admin/" replace />} />
    </Routes>
  )
}
