import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'

// Standalone Vitest config (no CRXJS plugin, which is build-only and would break
// the test runner). Vitest prefers vitest.config.ts over vite.config.ts.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/**/*.d.ts'],
    },
  },
})
