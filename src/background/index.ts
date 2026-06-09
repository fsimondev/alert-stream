import { log } from '../lib/log'
import type { Message } from '../lib/messaging'
import { getSettings } from '../lib/storage'
import { handleCommand } from './commands'
import { Engine } from './engine'

const engine = new Engine()

const KEEPALIVE_ALARM = 'livewatch-keepalive'

// --- lifecycle -------------------------------------------------------------

async function boot(): Promise<void> {
  try {
    await chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.5 })
    await engine.reconcile()
  } catch (e) {
    log.error('boot failed', e)
  }
}

// Top-level: runs every time the service worker spins up.
void boot()

chrome.runtime.onInstalled.addListener(() => void boot())
chrome.runtime.onStartup.addListener(() => void boot())

// Keepalive: wakes the SW periodically; reconnects any dead socket. WebSocket
// traffic itself keeps the worker alive between ticks (Chrome 116+).
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_ALARM) engine.checkHealth()
})

// --- config change reactions ----------------------------------------------

let reconcileTimer: ReturnType<typeof setTimeout> | undefined
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return
  if ('streamers' in changes || 'settings' in changes || 'auth' in changes) {
    // Debounce: a single UI action may touch several keys.
    clearTimeout(reconcileTimer)
    reconcileTimer = setTimeout(() => void engine.reconcile(), 150)
  }
})

// --- messaging -------------------------------------------------------------

chrome.runtime.onMessage.addListener((msg: Message & { target?: string }, _sender, sendResponse) => {
  // Messages addressed to the offscreen document are not for us.
  if (msg?.target === 'offscreen') return false
  handleCommand(engine, msg)
    .then(sendResponse)
    .catch((e) => sendResponse({ ok: false, error: String((e as Error).message ?? e) }))
  return true // async response
})

// --- notification clicks ---------------------------------------------------

chrome.notifications.onClicked.addListener((notificationId) => {
  void (async () => {
    const settings = await getSettings()
    if (settings.openOnClick && /^https?:\/\//.test(notificationId)) {
      await chrome.tabs.create({ url: notificationId })
    }
    chrome.notifications.clear(notificationId)
  })()
})

log.info('service worker loaded')
