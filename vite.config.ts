import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    proxy: { '/api/tutor': { target: 'http://127.0.0.1:8010', timeout: 900000, proxyTimeout: 900000 } },
  },
})
