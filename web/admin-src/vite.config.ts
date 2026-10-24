import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 管理后台 SPA：base /admin/，构建产物输出到 web/admin（由 Go 服务托管 + SPA fallback）
export default defineConfig({
  base: '/admin/',
  plugins: [react()],
  build: {
    outDir: '../admin',
    emptyOutDir: true,
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
