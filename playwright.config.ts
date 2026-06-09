import { defineConfig } from '@playwright/test'

// E2E loads the *built* extension into a real Chromium and drives its own UI.
// Chrome extensions require a persistent context + a headed/new-headless browser,
// so each test file launches its own context (see tests/e2e/fixtures.ts).
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
