import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
const isAnalyze = process.env.ANALYZE === 'true'

export default defineConfig({
  plugins: [
    react(),
    ...(isAnalyze
      ? [
          visualizer({
            filename: 'dist/bundle-stats.html',
            template: 'treemap',
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : [])
  ],
  base: './', // Ensure relative paths for Electron
  server: {
    proxy: {
      '/v1': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
