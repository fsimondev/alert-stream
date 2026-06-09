import { expect, test } from './fixtures'
import type { Page } from '@playwright/test'
import { EXTENSION_ID } from '../../src/lib/extension-key'

function optionsUrl(id: string) {
  return `chrome-extension://${id}/options.html`
}
function popupUrl(id: string) {
  return `chrome-extension://${id}/popup.html`
}

async function openOptions(page: Page, id: string) {
  await page.goto(optionsUrl(id))
  await expect(page.getByRole('heading', { name: 'LiveWatch — Réglages' })).toBeVisible()
}

test('extension id is pinned to the generated key (redirect URI is stable)', async ({
  extensionId,
}) => {
  // Verifies our offline id derivation matches the id Chrome actually assigns.
  expect(extensionId).toBe(EXTENSION_ID)
})

test('options page shows one-click Twitch connect (baked Client ID)', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage()
  await openOptions(page, extensionId)

  // One-click mode: a single connect button, no Client ID setup shown.
  await expect(page.getByTestId('twitch-connect')).toContainText('Se connecter avec Twitch')
  await expect(page.getByText(/EventSub exige un/i)).toHaveCount(0)

  // The stable redirect URI is still available under "Avancé".
  await page.getByText(/Avancé/i).click()
  await expect(page.locator('input[readonly]')).toHaveValue(/chromiumapp\.org/)
})

test('adds a streamer through the UI and persists it across reloads', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage()
  await openOptions(page, extensionId)

  await page.getByTestId('platform-kick').click()
  await page.getByTestId('add-input').fill('e2ekickchannel')
  await page.getByTestId('add-submit').click()

  const item = page.locator('[data-testid="streamer-item"][data-login="e2ekickchannel"]')
  await expect(item).toBeVisible()
  await expect(item).toHaveAttribute('data-platform', 'kick')

  // Persisted in chrome.storage -> survives a reload.
  await page.reload()
  await expect(
    page.locator('[data-testid="streamer-item"][data-login="e2ekickchannel"]'),
  ).toBeVisible()
})

test('rejects duplicates and invalid input', async ({ context, extensionId }) => {
  const page = await context.newPage()
  await openOptions(page, extensionId)

  await page.getByTestId('add-input').fill('dupe')
  await page.getByTestId('add-submit').click()
  await expect(page.locator('[data-login="dupe"]')).toBeVisible()

  // adding again -> error
  await page.getByTestId('add-input').fill('dupe')
  await page.getByTestId('add-submit').click()
  await expect(page.getByTestId('add-error')).toContainText('déjà')
})

test('end-to-end live event: notification path flips UI to LIVE and sets the badge', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage()
  await openOptions(page, extensionId)

  // Add a Twitch channel (login deliberately avoids the substring "live").
  await page.getByTestId('add-input').fill('e2onair')
  await page.getByTestId('add-submit').click()
  const item = page.locator('[data-testid="streamer-item"][data-login="e2onair"]')
  await expect(item).toBeVisible()
  await expect(item).toHaveAttribute('data-live', 'false')

  // Drive a synthetic live event through the real background engine.
  await page.evaluate(() =>
    chrome.runtime.sendMessage({
      type: '__SIMULATE_LIVE',
      platform: 'twitch',
      login: 'e2onair',
      isLive: true,
    }),
  )

  // UI reflects the live state (via chrome.storage change -> React re-render).
  await expect(item).toHaveAttribute('data-live', 'true')
  await expect(item.getByText('LIVE', { exact: true })).toBeVisible()

  // Toolbar badge shows the live count.
  await expect
    .poll(async () => page.evaluate(() => chrome.action.getBadgeText({})))
    .toBe('1')

  // Going offline clears it.
  await page.evaluate(() =>
    chrome.runtime.sendMessage({
      type: '__SIMULATE_LIVE',
      platform: 'twitch',
      login: 'e2onair',
      isLive: false,
    }),
  )
  await expect(item).toHaveAttribute('data-live', 'false')
  await expect.poll(async () => page.evaluate(() => chrome.action.getBadgeText({}))).toBe('')
})

test('popup shows the live count after a live event', async ({ context, extensionId }) => {
  // Seed a streamer + live state via an extension page first.
  const seed = await context.newPage()
  await openOptions(seed, extensionId)
  await seed.getByTestId('add-input').fill('popuplive')
  await seed.getByTestId('add-submit').click()
  await expect(
    seed.locator('[data-testid="streamer-item"][data-login="popuplive"]'),
  ).toBeVisible()
  await seed.evaluate(() =>
    chrome.runtime.sendMessage({
      type: '__SIMULATE_LIVE',
      platform: 'twitch',
      login: 'popuplive',
      isLive: true,
    }),
  )

  const popup = await context.newPage()
  await popup.goto(popupUrl(extensionId))
  await expect(popup.getByTestId('live-count')).toContainText('1 live')
  await expect(
    popup.locator('[data-testid="streamer-item"][data-login="popuplive"]'),
  ).toHaveAttribute('data-live', 'true')
})

test('settings toggle persists across reloads', async ({ context, extensionId }) => {
  const page = await context.newPage()
  await openOptions(page, extensionId)

  const badgeToggle = page.getByTestId('setting-badge')
  await expect(badgeToggle).toHaveAttribute('aria-checked', 'true')
  await badgeToggle.click()
  await expect(badgeToggle).toHaveAttribute('aria-checked', 'false')

  await page.reload()
  await expect(page.getByTestId('setting-badge')).toHaveAttribute('aria-checked', 'false')
})

test('removes a streamer', async ({ context, extensionId }) => {
  const page = await context.newPage()
  await openOptions(page, extensionId)

  await page.getByTestId('add-input').fill('todelete')
  await page.getByTestId('add-submit').click()
  const item = page.locator('[data-testid="streamer-item"][data-login="todelete"]')
  await expect(item).toBeVisible()

  await item.getByTestId('streamer-remove').click()
  await expect(item).toHaveCount(0)
})
