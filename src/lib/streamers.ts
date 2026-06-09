import type { ParsedInput } from './parse-input'
import type { Streamer } from './types'

export function makeStreamer(parsed: ParsedInput, id: string, now: number): Streamer {
  return {
    id,
    platform: parsed.platform,
    login: parsed.login,
    displayName: parsed.login,
    enabled: true,
    soundEnabled: true,
    addedAt: now,
  }
}

export function findDuplicate(list: Streamer[], parsed: ParsedInput): Streamer | undefined {
  return list.find((s) => s.platform === parsed.platform && s.login === parsed.login)
}

export function removeStreamer(list: Streamer[], id: string): Streamer[] {
  return list.filter((s) => s.id !== id)
}

export function updateStreamer(
  list: Streamer[],
  id: string,
  patch: Partial<Pick<Streamer, 'enabled' | 'soundEnabled' | 'displayName'>>,
): Streamer[] {
  return list.map((s) => (s.id === id ? { ...s, ...patch } : s))
}

export function sortStreamers(list: Streamer[]): Streamer[] {
  return [...list].sort((a, b) => a.displayName.localeCompare(b.displayName))
}
