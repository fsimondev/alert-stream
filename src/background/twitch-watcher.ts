import { log } from '../lib/log'
import {
  createSubscription,
  getStreamInfo,
  getUser,
} from '../lib/twitch/api'
import { parseTwitchMessage, TWITCH_EVENTSUB_WS_URL } from '../lib/twitch/messages'
import type { WatcherCallbacks } from './watcher-types'

interface Target {
  login: string
  userId?: string
  subscribed: boolean
}

/**
 * Maintains a single EventSub WebSocket and (re)creates `stream.online` /
 * `stream.offline` subscriptions for the set of target logins. Real-time push,
 * no polling. EventSub subscriptions are bound to the WS session, so on every
 * fresh connection we recreate them for the current targets.
 */
export class TwitchWatcher {
  private ws?: WebSocket
  private sessionId?: string
  private clientId = ''
  private token = ''
  private targets = new Map<string, Target>()
  private keepaliveSeconds = 10
  private lastMessageAt = 0
  private connecting = false
  private stopped = true

  constructor(private cb: WatcherCallbacks) {}

  setCredentials(clientId: string, token: string): void {
    const changed = clientId !== this.clientId || token !== this.token
    this.clientId = clientId
    this.token = token
    if (changed && !this.stopped) {
      // Force a clean reconnect so subscriptions use the new creds.
      this.teardown()
      this.connect()
    }
  }

  hasCredentials(): boolean {
    return !!this.clientId && !!this.token
  }

  /** Reconcile the desired set of logins. */
  setTargets(logins: string[]): void {
    const next = new Set(logins.map((l) => l.toLowerCase()))
    for (const login of [...this.targets.keys()]) {
      if (!next.has(login)) this.targets.delete(login)
    }
    for (const login of next) {
      if (!this.targets.has(login)) {
        this.targets.set(login, { login, subscribed: false })
      }
    }
  }

  start(): void {
    this.stopped = false
    if (this.targets.size === 0 || !this.hasCredentials()) return
    if (!this.ws) this.connect()
    else void this.syncSubscriptions()
  }

  stop(): void {
    this.stopped = true
    this.teardown()
  }

  /** Called periodically by the background alarm to recover a dead socket. */
  checkHealth(): void {
    if (this.stopped || this.targets.size === 0 || !this.hasCredentials()) return
    const stale =
      this.lastMessageAt > 0 &&
      Date.now() - this.lastMessageAt > (this.keepaliveSeconds + 10) * 1000
    const dead = !this.ws || this.ws.readyState === WebSocket.CLOSED
    if (dead || stale) {
      log.warn('Twitch socket stale/dead, reconnecting')
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
    this.sessionId = undefined
    for (const t of this.targets.values()) t.subscribed = false
  }

  private connect(url: string = TWITCH_EVENTSUB_WS_URL): void {
    if (this.connecting) return
    if (!this.hasCredentials() || this.targets.size === 0) return
    this.connecting = true
    this.cb.onStatus('twitch', '*', 'connecting')
    let ws: WebSocket
    try {
      ws = new WebSocket(url)
    } catch (e) {
      this.connecting = false
      this.cb.onStatus('twitch', '*', 'error', String(e))
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
      this.cb.onStatus('twitch', '*', 'error', 'WebSocket error')
    }
    ws.onclose = () => {
      this.connecting = false
      if (this.ws === ws) this.ws = undefined
      if (!this.stopped) this.cb.onStatus('twitch', '*', 'connecting')
    }
  }

  private async handleMessage(raw: string): Promise<void> {
    const msg = parseTwitchMessage(raw)
    switch (msg.kind) {
      case 'welcome':
        this.connecting = false
        this.sessionId = msg.sessionId
        this.keepaliveSeconds = msg.keepaliveSeconds
        await this.syncSubscriptions()
        break
      case 'keepalive':
        break
      case 'reconnect':
        // Twitch asked us to move to a new URL; subscriptions carry over.
        if (this.ws) {
          this.ws.onclose = null
          this.ws.close()
        }
        this.ws = undefined
        this.connect(msg.reconnectUrl)
        break
      case 'notification': {
        const event = msg.event
        const login = event.broadcaster_user_login?.toLowerCase()
        if (!login || !this.targets.has(login)) break
        const isLive = msg.subscriptionType === 'stream.online'
        const update = {
          platform: 'twitch' as const,
          login,
          isLive,
          platformId: event.broadcaster_user_id,
        }
        if (isLive) {
          // Single, event-driven enrichment call (not polling).
          const info = await getStreamInfo(this.clientId, this.token, event.broadcaster_user_id).catch(
            () => null,
          )
          this.cb.onLive({ ...update, title: info?.title, category: info?.category })
        } else {
          this.cb.onLive(update)
        }
        break
      }
      case 'revocation':
        this.cb.onStatus('twitch', '*', 'error', `Abonnement révoqué (${msg.status}).`)
        break
      default:
        break
    }
  }

  private async syncSubscriptions(): Promise<void> {
    if (!this.sessionId) return
    for (const target of this.targets.values()) {
      if (target.subscribed) continue
      try {
        if (!target.userId) {
          const user = await getUser(this.clientId, this.token, target.login)
          if (!user) {
            this.cb.onStatus('twitch', target.login, 'error', 'Chaîne introuvable.')
            continue
          }
          target.userId = user.id
          this.cb.onResolved('twitch', target.login, user.id)
        }
        await this.ensureSubscription(target, 'stream.online')
        await this.ensureSubscription(target, 'stream.offline')
        target.subscribed = true
        this.cb.onStatus('twitch', target.login, 'watching')
        // Startup snapshot: if already live, reflect it without notifying.
        if (target.userId) {
          const info = await getStreamInfo(this.clientId, this.token, target.userId).catch(
            () => null,
          )
          this.cb.onLive({
            platform: 'twitch',
            login: target.login,
            isLive: !!info,
            title: info?.title,
            category: info?.category,
            platformId: target.userId,
            initial: true,
          })
        }
      } catch (e) {
        log.error('Twitch subscribe failed for', target.login, e)
        this.cb.onStatus('twitch', target.login, 'error', String((e as Error).message ?? e))
      }
    }
  }

  private async ensureSubscription(
    target: Target,
    type: 'stream.online' | 'stream.offline',
  ): Promise<void> {
    if (!this.sessionId || !target.userId) return
    try {
      await createSubscription(this.clientId, this.token, this.sessionId, type, target.userId)
    } catch (e) {
      // 409 = subscription already exists for this session -> fine.
      if (!String((e as Error).message ?? '').includes('409')) throw e
    }
  }
}
