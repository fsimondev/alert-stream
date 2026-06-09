import { describe, expect, it } from 'vitest'
import {
  KICK_PUSHER_URL,
  kickChannelTopic,
  parseKickMessage,
} from '../../src/lib/kick/messages'

describe('parseKickMessage', () => {
  it('parses connection_established (data as JSON string)', () => {
    const raw = JSON.stringify({
      event: 'pusher:connection_established',
      data: JSON.stringify({ socket_id: '123.456', activity_timeout: 120 }),
    })
    expect(parseKickMessage(raw)).toEqual({
      kind: 'connection_established',
      socketId: '123.456',
      activityTimeout: 120,
    })
  })

  it('parses ping', () => {
    expect(parseKickMessage(JSON.stringify({ event: 'pusher:ping', data: {} }))).toEqual({ kind: 'ping' })
  })

  it('parses subscription succeeded', () => {
    const raw = JSON.stringify({
      event: 'pusher_internal:subscription_succeeded',
      channel: 'channel.42',
      data: {},
    })
    expect(parseKickMessage(raw)).toEqual({ kind: 'subscribed', channel: 'channel.42' })
  })

  it('parses StreamerIsLive (namespaced event + stringified data)', () => {
    const raw = JSON.stringify({
      event: 'App\\Events\\StreamerIsLive',
      channel: 'channel.229932',
      data: JSON.stringify({
        livestream: { id: 1015207, channel_id: 229932, session_title: 'GTA RP', created_at: 'x' },
      }),
    })
    expect(parseKickMessage(raw)).toEqual({ kind: 'live', channelId: 229932, title: 'GTA RP' })
  })

  it('parses StreamerIsLive with empty title -> undefined', () => {
    const raw = JSON.stringify({
      event: 'App\\Events\\StreamerIsLive',
      data: { livestream: { channel_id: 7, session_title: '' } },
    })
    expect(parseKickMessage(raw)).toEqual({ kind: 'live', channelId: 7, title: undefined })
  })

  it('parses StopStreamBroadcast', () => {
    const raw = JSON.stringify({
      event: 'App\\Events\\StopStreamBroadcast',
      data: JSON.stringify({ livestream: { id: 1, channel: { id: 229932 } } }),
    })
    expect(parseKickMessage(raw)).toEqual({ kind: 'offline', channelId: 229932 })
  })

  it('returns unknown for other events', () => {
    expect(parseKickMessage(JSON.stringify({ event: 'App\\Events\\ChatMessage' })).kind).toBe('unknown')
    expect(parseKickMessage('not json').kind).toBe('unknown')
  })
})

describe('kick constants', () => {
  it('builds the channel topic', () => {
    expect(kickChannelTopic(42)).toBe('channel.42')
  })
  it('uses the us2 pusher endpoint', () => {
    expect(KICK_PUSHER_URL).toContain('ws-us2.pusher.com')
    expect(KICK_PUSHER_URL).toContain('protocol=7')
  })
})
