import { vi } from 'vitest'

type Listener = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: string) => void

function makeArea(name: string, listeners: Listener[]) {
  let store: Record<string, unknown> = {}
  const pick = (keys?: string | string[] | Record<string, unknown> | null) => {
    if (keys == null) return { ...store }
    if (typeof keys === 'string') return keys in store ? { [keys]: store[keys] } : {}
    if (Array.isArray(keys)) {
      const out: Record<string, unknown> = {}
      for (const k of keys) if (k in store) out[k] = store[k]
      return out
    }
    // object with defaults
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(keys)) out[k] = k in store ? store[k] : keys[k]
    return out
  }
  return {
    _store: () => store,
    _reset: () => {
      store = {}
    },
    get: vi.fn(async (keys?: string | string[] | Record<string, unknown> | null) => pick(keys)),
    set: vi.fn(async (items: Record<string, unknown>) => {
      const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {}
      for (const k of Object.keys(items)) {
        changes[k] = { oldValue: store[k], newValue: items[k] }
        store[k] = items[k]
      }
      listeners.forEach((l) => l(changes, name))
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      const arr = Array.isArray(keys) ? keys : [keys]
      const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {}
      for (const k of arr) {
        if (k in store) {
          changes[k] = { oldValue: store[k], newValue: undefined }
          delete store[k]
        }
      }
      listeners.forEach((l) => l(changes, name))
    }),
    clear: vi.fn(async () => {
      store = {}
    }),
  }
}

export type ChromeMock = ReturnType<typeof installChromeMock>

export function installChromeMock() {
  const listeners: Listener[] = []
  const sync = makeArea('sync', listeners)
  const local = makeArea('local', listeners)

  const chrome = {
    storage: {
      sync,
      local,
      onChanged: {
        addListener: (l: Listener) => listeners.push(l),
        removeListener: (l: Listener) => {
          const i = listeners.indexOf(l)
          if (i >= 0) listeners.splice(i, 1)
        },
      },
    },
    runtime: {
      id: 'test-extension-id',
      sendMessage: vi.fn(async () => ({ ok: true })),
      getURL: (p: string) => `chrome-extension://test-extension-id/${p}`,
      openOptionsPage: vi.fn(),
      getContexts: vi.fn(async () => [] as unknown[]),
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      onInstalled: { addListener: vi.fn() },
      onStartup: { addListener: vi.fn() },
    },
    identity: {
      getRedirectURL: vi.fn(() => 'https://test-extension-id.chromiumapp.org/'),
      launchWebAuthFlow: vi.fn(),
    },
    notifications: {
      create: vi.fn(),
      clear: vi.fn(),
      onClicked: { addListener: vi.fn() },
    },
    action: {
      setBadgeText: vi.fn(async () => undefined),
      setBadgeBackgroundColor: vi.fn(async () => undefined),
      setBadgeTextColor: vi.fn(async () => undefined),
    },
    alarms: {
      create: vi.fn(async () => undefined),
      onAlarm: { addListener: vi.fn() },
    },
    offscreen: {
      createDocument: vi.fn(async () => undefined),
      Reason: { AUDIO_PLAYBACK: 'AUDIO_PLAYBACK' },
    },
    tabs: { create: vi.fn(async () => undefined) },
  }

  ;(globalThis as unknown as { chrome: unknown }).chrome = chrome
  return chrome
}
