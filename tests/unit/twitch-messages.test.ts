import { describe, expect, it } from 'vitest'
import { parseTwitchMessage } from '../../src/lib/twitch/messages'

const welcome = JSON.stringify({
  metadata: { message_type: 'session_welcome' },
  payload: { session: { id: 'sess-123', keepalive_timeout_seconds: 30 } },
})

const onlineNotif = JSON.stringify({
  metadata: { message_type: 'notification', subscription_type: 'stream.online' },
  payload: {
    subscription: { type: 'stream.online' },
    event: {
      broadcaster_user_id: '12345',
      broadcaster_user_login: 'xqc',
      broadcaster_user_name: 'xQc',
      type: 'live',
      started_at: '2026-06-01T10:00:00Z',
    },
  },
})

describe('parseTwitchMessage', () => {
  it('parses welcome', () => {
    expect(parseTwitchMessage(welcome)).toEqual({
      kind: 'welcome',
      sessionId: 'sess-123',
      keepaliveSeconds: 30,
    })
  })

  it('parses keepalive', () => {
    expect(parseTwitchMessage(JSON.stringify({ metadata: { message_type: 'session_keepalive' } }))).toEqual(
      { kind: 'keepalive' },
    )
  })

  it('parses stream.online notification', () => {
    const m = parseTwitchMessage(onlineNotif)
    expect(m.kind).toBe('notification')
    if (m.kind === 'notification') {
      expect(m.subscriptionType).toBe('stream.online')
      expect(m.event.broadcaster_user_login).toBe('xqc')
    }
  })

  it('parses stream.offline notification', () => {
    const raw = JSON.stringify({
      metadata: { message_type: 'notification', subscription_type: 'stream.offline' },
      payload: {
        event: { broadcaster_user_id: '1', broadcaster_user_login: 'a', broadcaster_user_name: 'A' },
      },
    })
    const m = parseTwitchMessage(raw)
    expect(m.kind === 'notification' && m.subscriptionType).toBe('stream.offline')
  })

  it('parses reconnect', () => {
    const raw = JSON.stringify({
      metadata: { message_type: 'session_reconnect' },
      payload: { session: { reconnect_url: 'wss://new.example/ws' } },
    })
    expect(parseTwitchMessage(raw)).toEqual({ kind: 'reconnect', reconnectUrl: 'wss://new.example/ws' })
  })

  it('parses revocation', () => {
    const raw = JSON.stringify({
      metadata: { message_type: 'revocation', subscription_type: 'stream.online' },
      payload: { subscription: { status: 'authorization_revoked' } },
    })
    expect(parseTwitchMessage(raw)).toEqual({
      kind: 'revocation',
      subscriptionType: 'stream.online',
      status: 'authorization_revoked',
    })
  })

  it('accepts already-parsed objects', () => {
    expect(parseTwitchMessage(JSON.parse(welcome)).kind).toBe('welcome')
  })

  it('returns unknown for garbage', () => {
    expect(parseTwitchMessage('{not json').kind).toBe('unknown')
    expect(parseTwitchMessage(JSON.stringify({ metadata: { message_type: 'whatever' } })).kind).toBe(
      'unknown',
    )
  })
})
