import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API calls to the FastAPI backend during dev so the demo dashboard
    // can call /v1/score without CORS friction.
    proxy: {
      '/v1': 'http://localhost:8000',
    },
  },
})
