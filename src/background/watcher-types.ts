import type { Platform, StreamerRuntime } from '../lib/types'

export interface LiveUpdate {
  platform: Platform
  login: string
  isLive: boolean
  title?: string
  category?: string
  platformId?: string
  /** True for a startup snapshot (sets state without notifying/playing sound). */
  initial?: boolean
}

export interface WatcherCallbacks {
  /** A live/offline transition (or refresh) for a target. */
  onLive(update: LiveUpdate): void
  /** A target's platform id (Twitch user_id / Kick channel_id) became known. */
  onResolved(platform: Platform, login: string, platformId: string): void
  /** Connection/health status for a target (or all targets of a platform). */
  onStatus(
    platform: Platform,
    login: string | '*',
    status: StreamerRuntime['status'],
    error?: string,
  ): void
}
