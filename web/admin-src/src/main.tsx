import React, { useMemo } from 'react'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import { createRoot } from 'react-dom/client'
import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import App from './App'
import { buildThemeConfig } from './theme'
import './styles/admin.css'

dayjs.locale('zh-cn')

// 应用根：把当前解析后的主题交给 AntD，切换主题时无需重挂载页面。
function Root(): JSX.Element {
  const { resolved } = useTheme()
  const themeConfig = useMemo(() => buildThemeConfig(resolved), [resolved])

  return (
    <ConfigProvider locale={zhCN} theme={themeConfig}>
      <AntdApp>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  )
}

const root = createRoot(document.getElementById('root') as HTMLElement)
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <Root />
    </ThemeProvider>
  </React.StrictMode>,
)
