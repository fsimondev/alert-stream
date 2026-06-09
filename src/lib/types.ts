import { DEFAULT_TWITCH_CLIENT_ID } from './config'

export type Platform = 'twitch' | 'kick'

/** A streamer the user follows. Persisted in chrome.storage. */
export interface Streamer {
  /** Stable internal id (uuid). */
  id: string
  platform: Platform
  /** Normalized login / channel slug, lowercase. */
  login: string
  /** Human-friendly name shown in the UI (defaults to login). */
  displayName: string
  /** Whether notifications are enabled for this streamer. */
  enabled: boolean
  /** Per-streamer sound override (global sound must also be on). */
  soundEnabled: boolean
  /** When the streamer was added (ms epoch). */
  addedAt: number
}

/** Runtime/live state for a streamer. Written by the background worker. */
export interface StreamerRuntime {
  /** Is the streamer currently live. */
  isLive: boolean
  /** Last time the live state changed (ms epoch). */
  lastChangedAt: number
  /** Cached platform id: Twitch user_id or Kick channel_id. */
  platformId?: string
  /** Current stream title, when known. */
  title?: string
  /** Current category/game, when known. */
  category?: string
  /** Connection health for this streamer's transport. */
  status: 'connecting' | 'watching' | 'error' | 'idle'
  /** Last error message, if status === 'error'. */
  error?: string
}

export interface Settings {
  /** User-provided Twitch application Client ID (no secret needed for implicit flow). */
  twitchClientId: string
  /** Global sound toggle. */
  soundEnabled: boolean
  /** 0..1 */
  soundVolume: number
  /** Open the stream in a new tab when the notification is clicked. */
  openOnClick: boolean
  /** Show the live count badge on the toolbar icon. */
  showBadge: boolean
}

export interface TwitchAuth {
  accessToken: string
  /** ms epoch when the token was obtained. */
  obtainedAt: number
  /** ms epoch when the token expires (from validate endpoint). */
  expiresAt: number
  login?: string
  userId?: string
}

export interface AuthState {
  twitch?: TwitchAuth
}

export const DEFAULT_SETTINGS: Settings = {
  twitchClientId: DEFAULT_TWITCH_CLIENT_ID,
  soundEnabled: true,
  soundVolume: 0.7,
  openOnClick: true,
  showBadge: true,
}

/** A normalized live event flowing through the engine. */
export interface LiveEvent {
  platform: Platform
  /** Matches Streamer.login. */
  login: string
  isLive: boolean
  title?: string
  category?: string
  platformId?: string
}
