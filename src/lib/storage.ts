import {
  type AuthState,
  type Settings,
  type Streamer,
  type StreamerRuntime,
  DEFAULT_SETTINGS,
} from './types'

/**
 * Typed wrapper around chrome.storage. Streamers + settings live in `sync`
 * (roams with the user's profile); volatile runtime live-state lives in `local`.
 */

export const KEYS = {
  streamers: 'streamers',
  settings: 'settings',
  auth: 'auth',
  runtime: 'runtime', // local-only
} as const

type RuntimeMap = Record<string, StreamerRuntime>

async function getSync<T>(key: string, fallback: T): Promise<T> {
  const res = await chrome.storage.sync.get(key)
  return (res[key] as T) ?? fallback
}

async function getLocal<T>(key: string, fallback: T): Promise<T> {
  const res = await chrome.storage.local.get(key)
  return (res[key] as T) ?? fallback
}

export async function getStreamers(): Promise<Streamer[]> {
  return getSync<Streamer[]>(KEYS.streamers, [])
}

export async function setStreamers(list: Streamer[]): Promise<void> {
  await chrome.storage.sync.set({ [KEYS.streamers]: list })
}

export async function getSettings(): Promise<Settings> {
  const stored = await getSync<Partial<Settings>>(KEYS.settings, {})
  return { ...DEFAULT_SETTINGS, ...stored }
}

export async function setSettings(settings: Settings): Promise<void> {
  await chrome.storage.sync.set({ [KEYS.settings]: settings })
}

export async function getAuth(): Promise<AuthState> {
  return getSync<AuthState>(KEYS.auth, {})
}

export async function setAuth(auth: AuthState): Promise<void> {
  await chrome.storage.sync.set({ [KEYS.auth]: auth })
}

export async function getRuntime(): Promise<RuntimeMap> {
  return getLocal<RuntimeMap>(KEYS.runtime, {})
}

export async function setRuntime(map: RuntimeMap): Promise<void> {
  await chrome.storage.local.set({ [KEYS.runtime]: map })
}

// Serialize read-modify-write runtime mutations so concurrent event handlers
// don't clobber each other (single-threaded JS still interleaves at awaits).
let runtimeChain: Promise<unknown> = Promise.resolve()
function queueRuntime<T>(fn: () => Promise<T>): Promise<T> {
  const next = runtimeChain.then(fn, fn)
  runtimeChain = next.catch(() => undefined)
  return next
}

export function patchRuntime(
  id: string,
  patch: Partial<StreamerRuntime>,
): Promise<RuntimeMap> {
  return queueRuntime(async () => {
    const map = await getRuntime()
    const prev: StreamerRuntime = map[id] ?? {
      isLive: false,
      lastChangedAt: 0,
      status: 'idle',
    }
    map[id] = { ...prev, ...patch }
    await setRuntime(map)
    return map
  })
}

/** Drop runtime entries whose streamer no longer exists. */
export function pruneRuntime(validIds: Set<string>): Promise<void> {
  return queueRuntime(async () => {
    const map = await getRuntime()
    let changed = false
    for (const id of Object.keys(map)) {
      if (!validIds.has(id)) {
        delete map[id]
        changed = true
      }
    }
    if (changed) await setRuntime(map)
  })
}

type Area = 'sync' | 'local'

/**
 * Subscribe to a specific storage key. Returns an unsubscribe function.
 * Used by the UI to react to background-driven state changes.
 */
export function onKeyChanged<T>(
  key: string,
  area: Area,
  cb: (value: T | undefined) => void,
): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    changedArea: string,
  ) => {
    if (changedArea !== area) return
    if (key in changes) cb(changes[key].newValue as T | undefined)
  }
  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}
