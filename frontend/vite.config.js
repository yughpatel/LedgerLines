import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The app calls the API under /api. This proxy forwards it to the backend and strips
// /api, exactly like the Vercel rewrite in production, so development and production
// share one origin and the refresh cookie (path /api/auth) works the same in both.
// API_PROXY_TARGET points it somewhere other than a local backend on port 8000
const apiTarget = process.env.API_PROXY_TARGET || 'http://localhost:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
