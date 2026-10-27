import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 管理后台 SPA：base /admin/，构建产物输出到 web/admin（由 Go 服务托管 + SPA fallback）
export default defineConfig({
  base: '/admin/',
  plugins: [react()],
  build: {
    outDir: '../admin',
    emptyOutDir: true,
    // 依赖拆成独立 chunk：发版时只有业务代码的 hash 变化，
    // antd/react 仍命中一年期 immutable 缓存，老后台用户不用重新下 1MB
    rollupOptions: {
      output: {
        manualChunks(id: string): string | undefined {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('antd') || id.includes('@ant-design') || id.includes('rc-')) return 'antd'
          if (id.includes('react') || id.includes('scheduler')) return 'react'
          return 'vendor'
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: false },
      '/uploads': { target: 'http://localhost:8080', changeOrigin: false },
      '/static': { target: 'http://localhost:8080', changeOrigin: false },
    },
  },
})
