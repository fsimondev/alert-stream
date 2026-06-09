/**
 * Pure parsing of Kick's Pusher WebSocket frames.
 * Kick's frontend uses Pusher; the public `channel.<id>` channel broadcasts
 * `App\Events\StreamerIsLive` when a broadcast starts. No auth is required for
 * these public events. Kept dependency-free for unit testing.
 */

export type KickMessage =
  | { kind: 'connection_established'; socketId: string; activityTimeout: number }
  | { kind: 'ping' }
  | { kind: 'pong' }
  | { kind: 'subscribed'; channel: string }
  | { kind: 'live'; channelId: number; title?: string }
  | { kind: 'offline'; channelId: number }
  | { kind: 'unknown'; event?: string }

interface Frame {
  event?: string
  data?: unknown
  channel?: string
}

/** Pusher `data` fields are usually JSON-encoded strings; tolerate objects too. */
function asObject(data: unknown): Record<string, unknown> {
  if (data == null) return {}
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  if (typeof data === 'object') return data as Record<string, unknown>
  return {}
}

export function parseKickMessage(raw: string | object): KickMessage {
  let frame: Frame
  try {
    frame = typeof raw === 'string' ? JSON.parse(raw) : (raw as Frame)
  } catch {
    return { kind: 'unknown' }
  }
  const event = frame.event ?? ''

  switch (event) {
    case 'pusher:connection_established': {
      const d = asObject(frame.data)
      return {
        kind: 'connection_established',
        socketId: String(d.socket_id ?? ''),
        activityTimeout: Number(d.activity_timeout ?? 120),
      }
    }
    case 'pusher:ping':
      return { kind: 'ping' }
    case 'pusher:pong':
      return { kind: 'pong' }
    case 'pusher_internal:subscription_succeeded':
      return { kind: 'subscribed', channel: frame.channel ?? '' }
  }

  // App-level events (namespaced). Match by suffix to be resilient to escaping.
  if (event.endsWith('StreamerIsLive')) {
    const d = asObject(frame.data)
    const ls = asObject(d.livestream)
    const channelId = Number(ls.channel_id ?? d.channel_id ?? 0)
    const title = typeof ls.session_title === 'string' ? ls.session_title : undefined
    return { kind: 'live', channelId, title: title || undefined }
  }
  if (event.endsWith('StopStreamBroadcast')) {
    const d = asObject(frame.data)
    const ls = asObject(d.livestream)
    const ch = asObject(ls.channel)
    const channelId = Number(ch.id ?? d.channel_id ?? 0)
    return { kind: 'offline', channelId }
  }

  return { kind: 'unknown', event }
}

// Public Pusher app key used by kick.com (cluster us2). Stable, client-side key.
export const KICK_PUSHER_KEY = '32cbd69e4b950bf97679'
export const KICK_PUSHER_CLUSTER = 'us2'
export const KICK_PUSHER_URL =
  `wss://ws-${KICK_PUSHER_CLUSTER}.pusher.com/app/${KICK_PUSHER_KEY}` +
  `?protocol=7&client=js&version=8.4.0&flash=false`

export function kickChannelTopic(channelId: number | string): string {
  return `channel.${channelId}`
}
