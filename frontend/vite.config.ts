import path from 'node:path'
import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig } from 'vitest/config'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const analyze = process.env.ANALYZE === '1'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ...(analyze
      ? [visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true })]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }
          if (/[\\/]node_modules[\\/](react|react-dom|react-router-dom|scheduler)[\\/]/.test(id)) {
            return 'react'
          }
          if (id.includes('@tanstack')) {
            return 'tanstack'
          }
          if (id.includes('lucide-react')) {
            return 'icons'
          }
          return undefined
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
