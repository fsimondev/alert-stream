import type { Platform } from './types'

export interface ParsedInput {
  platform: Platform
  /** Normalized lowercase login/slug. */
  login: string
}

// Twitch & Kick logins: letters, digits, underscore. Twitch min 3 / Kick allows
// shorter handles, so we accept 2..30 and let the platform reject if invalid.
const LOGIN_RE = /^[a-zA-Z0-9_]{2,30}$/

const HOST_PLATFORM: Record<string, Platform> = {
  'twitch.tv': 'twitch',
  'www.twitch.tv': 'twitch',
  'm.twitch.tv': 'twitch',
  'kick.com': 'kick',
  'www.kick.com': 'kick',
}

// Twitch route segments that are not usernames.
const TWITCH_RESERVED = new Set([
  'directory', 'videos', 'p', 'settings', 'subscriptions', 'inventory',
  'wallet', 'friends', 'directory', 'downloads', 'jobs', 'turbo', 'store',
])

function cleanSegment(seg: string): string {
  return seg.replace(/^@/, '').trim().toLowerCase()
}

/**
 * Parse a user-typed channel reference into { platform, login }.
 *
 * Accepts full URLs (https://twitch.tv/xqc, kick.com/trainwreckstv/videos),
 * host-less URLs (twitch.tv/xqc) and bare handles (xqc) when a `hint` platform
 * is provided. Returns null when it cannot be resolved confidently.
 */
export function parseStreamInput(raw: string, hint?: Platform): ParsedInput | null {
  const input = raw.trim()
  if (!input) return null

  // Looks like a URL or a host/path reference (contains a dot before any slash,
  // or an explicit scheme).
  const hasScheme = /^[a-z]+:\/\//i.test(input)
  const looksLikeUrl = hasScheme || /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(input)

  if (looksLikeUrl) {
    let url: URL
    try {
      url = new URL(hasScheme ? input : `https://${input}`)
    } catch {
      return null
    }
    const host = url.hostname.toLowerCase()
    const platform = HOST_PLATFORM[host]
    if (!platform) return null
    const segments = url.pathname.split('/').filter(Boolean)
    if (segments.length === 0) return null
    const login = cleanSegment(segments[0])
    if (platform === 'twitch' && TWITCH_RESERVED.has(login)) return null
    if (!LOGIN_RE.test(login)) return null
    return { platform, login }
  }

  // Bare handle: requires a platform hint.
  if (!hint) return null
  const login = cleanSegment(input)
  if (!LOGIN_RE.test(login)) return null
  return { platform: hint, login }
}

/** Public channel URL for a streamer (used by notifications + UI links). */
export function channelUrl(platform: Platform, login: string): string {
  return platform === 'twitch'
    ? `https://www.twitch.tv/${login}`
    : `https://kick.com/${login}`
}
