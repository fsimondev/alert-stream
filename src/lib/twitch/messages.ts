/**
 * Pure parsing of Twitch EventSub (WebSocket transport) messages.
 * Kept free of any WebSocket / chrome dependency so it is fully unit-testable
 * against recorded payloads.
 *
 * Docs: https://dev.twitch.tv/docs/eventsub/handling-websocket-events/
 */

export interface TwitchStreamEvent {
  broadcaster_user_id: string
  broadcaster_user_login: string
  broadcaster_user_name: string
  type?: string
  started_at?: string
}

export type TwitchMessage =
  | { kind: 'welcome'; sessionId: string; keepaliveSeconds: number }
  | { kind: 'keepalive' }
  | { kind: 'reconnect'; reconnectUrl: string }
  | { kind: 'notification'; subscriptionType: string; event: TwitchStreamEvent }
  | { kind: 'revocation'; subscriptionType: string; status: string }
  | { kind: 'unknown'; messageType?: string }

interface Envelope {
  metadata?: {
    message_type?: string
    subscription_type?: string
  }
  payload?: {
    session?: { id?: string; keepalive_timeout_seconds?: number; reconnect_url?: string }
    subscription?: { type?: string; status?: string }
    event?: TwitchStreamEvent
  }
}

export function parseTwitchMessage(raw: string | object): TwitchMessage {
  let env: Envelope
  try {
    env = typeof raw === 'string' ? JSON.parse(raw) : (raw as Envelope)
  } catch {
    return { kind: 'unknown' }
  }
  const type = env.metadata?.message_type
  switch (type) {
    case 'session_welcome': {
      const session = env.payload?.session
      return {
        kind: 'welcome',
        sessionId: session?.id ?? '',
        keepaliveSeconds: session?.keepalive_timeout_seconds ?? 10,
      }
    }
    case 'session_keepalive':
      return { kind: 'keepalive' }
    case 'session_reconnect':
      return { kind: 'reconnect', reconnectUrl: env.payload?.session?.reconnect_url ?? '' }
    case 'notification': {
      const event = env.payload?.event
      if (!event) return { kind: 'unknown', messageType: type }
      return {
        kind: 'notification',
        subscriptionType: env.metadata?.subscription_type ?? env.payload?.subscription?.type ?? '',
        event,
      }
    }
    case 'revocation':
      return {
        kind: 'revocation',
        subscriptionType: env.metadata?.subscription_type ?? '',
        status: env.payload?.subscription?.status ?? '',
      }
    default:
      return { kind: 'unknown', messageType: type }
  }
}

export const TWITCH_EVENTSUB_WS_URL = 'wss://eventsub.wss.twitch.tv/ws'
export const TWITCH_HELIX = 'https://api.twitch.tv/helix'
export const TWITCH_OAUTH = 'https://id.twitch.tv/oauth2'
