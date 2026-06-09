import { log } from '../lib/log'
import { resolveKickChannel } from '../lib/kick/api'
import {
  KICK_PUSHER_URL,
  kickChannelTopic,
  parseKickMessage,
} from '../lib/kick/messages'
import type { WatcherCallbacks } from './watcher-types'

interface Target {
  login: string
  channelId?: number
  subscribed: boolean
}

/**
 * Maintains a single Pusher WebSocket and subscribes to `channel.<id>` for each
 * target. Listens for `App\Events\StreamerIsLive` / `StopStreamBroadcast`.
 * Real-time push, no polling. (Unofficial: relies on Kick's public Pusher feed.)
 */
export class KickWatcher {
  private ws?: WebSocket
  private targets = new Map<string, Target>()
  private byChannel = new Map<number, string>()
  private connecting = false
  private stopped = true
  private established = false
  private lastMessageAt = 0
  private activityTimeout = 120

  constructor(private cb: WatcherCallbacks) {}

  setTargets(logins: string[]): void {
    const next = new Set(logins.map((l) => l.toLowerCase()))
    for (const login of [...this.targets.keys()]) {
      if (!next.has(login)) {
        const t = this.targets.get(login)
        if (t?.channelId != null) this.byChannel.delete(t.channelId)
        this.targets.delete(login)
      }
    }
    for (const login of next) {
      if (!this.targets.has(login)) {
        this.targets.set(login, { login, subscribed: false })
      }
    }
  }

  start(): void {
    this.stopped = false
    if (this.targets.size === 0) return
    if (!this.ws) this.connect()
    else if (this.established) void this.syncSubscriptions()
  }

  stop(): void {
    this.stopped = true
    this.teardown()
  }

  checkHealth(): void {
    if (this.stopped || this.targets.size === 0) return
    const stale =
      this.lastMessageAt > 0 &&
      Date.now() - this.lastMessageAt > (this.activityTimeout + 15) * 1000
    const dead = !this.ws || this.ws.readyState === WebSocket.CLOSED
    if (dead || stale) {
      log.warn('Kick socket stale/dead, reconnecting')
      this.teardown()
      this.connect()
    }
  }

  private teardown(): void {
    if (this.ws) {
      try {
        this.ws.onclose = null
        this.ws.close()
      } catch {
        /* ignore */
      }
    }
    this.ws = undefined
    this.established = false
    for (const t of this.targets.values()) t.subscribed = false
  }

  private connect(): void {
    if (this.connecting || this.targets.size === 0) return
    this.connecting = true
    this.cb.onStatus('kick', '*', 'connecting')
    let ws: WebSocket
    try {
      ws = new WebSocket(KICK_PUSHER_URL)
    } catch (e) {
      this.connecting = false
      this.cb.onStatus('kick', '*', 'error', String(e))
      return
    }
    this.ws = ws
    ws.onopen = () => {
      this.lastMessageAt = Date.now()
    }
    ws.onmessage = (ev) => {
      this.lastMessageAt = Date.now()
      void this.handleMessage(String(ev.data))
    }
    ws.onerror = () => {
      this.cb.onStatus('kick', '*', 'error', 'WebSocket error')
    }
    ws.onclose = () => {
      this.connecting = false
      this.established = false
      if (this.ws === ws) this.ws = undefined
      if (!this.stopped) this.cb.onStatus('kick', '*', 'connecting')
    }
  }

  private send(obj: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj))
    }
  }

  private async handleMessage(raw: string): Promise<void> {
    const msg = parseKickMessage(raw)
    switch (msg.kind) {
      case 'connection_established':
        this.connecting = false
        this.established = true
        this.activityTimeout = msg.activityTimeout || 120
        await this.syncSubscriptions()
        break
      case 'ping':
        this.send({ event: 'pusher:pong', data: {} })
        break
      case 'pong':
        break
      case 'subscribed':
        break
      case 'live': {
        const login = this.byChannel.get(msg.channelId)
        if (login) {
          this.cb.onLive({
            platform: 'kick',
            login,
            isLive: true,
            title: msg.title,
            platformId: String(msg.channelId),
          })
        }
        break
      }
      case 'offline': {
        const login = this.byChannel.get(msg.channelId)
        if (login) {
          this.cb.onLive({ platform: 'kick', login, isLive: false, platformId: String(msg.channelId) })
        }
        break
      }
      default:
        break
    }
  }

  private async syncSubscriptions(): Promise<void> {
    if (!this.established) return
    for (const target of this.targets.values()) {
      if (target.subscribed) continue
      try {
        if (target.channelId == null) {
          const ch = await resolveKickChannel(target.login)
          if (!ch) {
            this.cb.onStatus('kick', target.login, 'error', 'Chaîne introuvable.')
            continue
          }
          target.channelId = ch.channelId
          this.byChannel.set(ch.channelId, target.login)
          this.cb.onResolved('kick', target.login, String(ch.channelId))
          // Startup snapshot without notifying.
          this.cb.onLive({
            platform: 'kick',
            login: target.login,
            isLive: ch.isLive,
            title: ch.title,
            category: ch.category,
            platformId: String(ch.channelId),
            initial: true,
          })
        }
        this.send({ event: 'pusher:subscribe', data: { channel: kickChannelTopic(target.channelId) } })
        target.subscribed = true
        this.cb.onStatus('kick', target.login, 'watching')
      } catch (e) {
        log.error('Kick subscribe failed for', target.login, e)
        this.cb.onStatus('kick', target.login, 'error', String((e as Error).message ?? e))
      }
    }
  }
}
