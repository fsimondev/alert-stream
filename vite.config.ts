import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './src/manifest.config'

// CRXJS builds the MV3 extension from the manifest: it picks up popup.html and
// options.html, the module service worker, icons and web_accessible_resources.
// offscreen.html is created at runtime (chrome.offscreen) so it is not in any
// manifest field CRXJS scans automatically -> we add it as an explicit input.
export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        offscreen: resolve(__dirname, 'offscreen.html'),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
  },
})
