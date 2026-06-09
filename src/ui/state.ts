import { useEffect, useState } from 'react'
import { KEYS, onKeyChanged } from '../lib/storage'
import {
  type AuthState,
  type Settings,
  type Streamer,
  type StreamerRuntime,
  DEFAULT_SETTINGS,
} from '../lib/types'

type Area = 'sync' | 'local'
type RuntimeMap = Record<string, StreamerRuntime>

/** Read a storage key and stay in sync with background-driven changes. */
function useStorageKey<T>(key: string, area: Area, fallback: T): T {
  const [value, setValue] = useState<T>(fallback)
  useEffect(() => {
    let alive = true
    const store = area === 'sync' ? chrome.storage.sync : chrome.storage.local
    void store.get(key).then((res) => {
      if (alive) setValue((res[key] as T) ?? fallback)
    })
    const unsub = onKeyChanged<T>(key, area, (v) => setValue(v ?? fallback))
    return () => {
      alive = false
      unsub()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, area])
  return value
}

export function useStreamers(): Streamer[] {
  return useStorageKey<Streamer[]>(KEYS.streamers, 'sync', [])
}

export function useRuntime(): RuntimeMap {
  return useStorageKey<RuntimeMap>(KEYS.runtime, 'local', {})
}

export function useSettings(): Settings {
  const stored = useStorageKey<Partial<Settings>>(KEYS.settings, 'sync', {})
  return { ...DEFAULT_SETTINGS, ...stored }
}

export function useAuth(): AuthState {
  return useStorageKey<AuthState>(KEYS.auth, 'sync', {})
}

export function liveCount(streamers: Streamer[], runtime: RuntimeMap): number {
  return streamers.filter((s) => runtime[s.id]?.isLive).length
}
