import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import type { ProxyOptions } from 'vite'

const apiProxy: ProxyOptions = {
  target: 'http://localhost:3000',
  changeOrigin: false,
  bypass(request) {
    if ((request.method === 'GET' || request.method === 'HEAD') && request.headers.accept?.includes('text/html')) {
      return '/index.html'
    }
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    proxy: {
      '/auth': { ...apiProxy },
      '/clientes': { ...apiProxy },
      '/orcamentos': { ...apiProxy },
      '/dashboard': { ...apiProxy },
      '/dados-do-negocio': { ...apiProxy },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
