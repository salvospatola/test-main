import path from "path"
import fs from "fs"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isDocker = fs.existsSync('/.dockerenv')
  const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || (isDocker ? 'http://api:3000' : 'http://localhost:3000')
  return ({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      ...(mode === 'test' ? {
        "react-dom/test-utils": "react",
      } : {})
    },
  },
  server: {
    proxy: {
      '/api': apiProxyTarget,
      '/uploads': apiProxyTarget
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [path.resolve(__dirname, './src/tests/setup.jsx')],
  },
})})
