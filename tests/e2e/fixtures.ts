import { test as base, chromium, type BrowserContext, type Worker } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const EXTENSION_PATH = path.resolve(dirname, '../../dist')

/**
 * Loads the *built* extension (dist/) into a real Chromium. Chrome extensions
 * require a persistent context and a headed/new-headless browser, so each test
 * gets its own fresh profile (and therefore clean chrome.storage).
 */
export const test = base.extend<{
  context: BrowserContext
  extensionId: string
}>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    })
    await use(context)
    await context.close()
  },
  extensionId: async ({ context }, use) => {
    let [sw] = context.serviceWorkers()
    if (!sw) sw = await context.waitForEvent('serviceworker')
    // chrome-extension://<id>/...
    const id = (sw as Worker).url().split('/')[2]
    await use(id)
  },
})

export const expect = test.expect
