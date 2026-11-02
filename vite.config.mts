import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const root = path.dirname(fileURLToPath(import.meta.url))
const entries = (process.env.RA_UI_ENTRIES || 'popup,editor').split(',')

export default defineConfig({
  root: path.join(root, 'ui'),
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.join(root, 'ui/src'),
      '@shared': path.join(root, 'src/lib'),
    },
  },
  build: {
    outDir: process.env.RA_UI_OUT || path.join(root, 'build-ui'),
    emptyOutDir: true,
    target: 'chrome140',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: Object.fromEntries(entries.map((e) => [e, path.join(root, `ui/${e}.html`)])),
    },
  },
})
