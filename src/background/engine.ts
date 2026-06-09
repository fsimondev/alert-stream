import { log } from '../lib/log'
import {
  getAuth,
  getRuntime,
  getSettings,
  getStreamers,
  patchRuntime,
  pruneRuntime,
} from '../lib/storage'
import type { Platform, Settings, Streamer, StreamerRuntime } from '../lib/types'
import { DEFAULT_SETTINGS } from '../lib/types'
import { shouldNotify } from './decide'
import { createLiveNotification, playAlert, updateBadge } from './effects'
import { KickWatcher } from './kick-watcher'
import { TwitchWatcher } from './twitch-watcher'
import type { LiveUpdate, WatcherCallbacks } from './watcher-types'

/**
 * Central orchestrator: loads config from storage, drives the two watchers,
 * funnels live events into notifications/badge/sound, and writes runtime state
 * back to storage for the UI to read.
 */
export class Engine {
  private twitch: TwitchWatcher
  private kick: KickWatcher
  private streamers: Streamer[] = []
  private settings: Settings = DEFAULT_SETTINGS

  constructor() {
    const cb: WatcherCallbacks = {
      onLive: this.handleLive,
      onResolved: this.handleResolved,
      onStatus: this.handleStatus,
    }
    this.twitch = new TwitchWatcher(cb)
    this.kick = new KickWatcher(cb)
  }

  /** (Re)load config from storage and reconcile both watchers. Idempotent. */
  async reconcile(): Promise<void> {
    this.streamers = await getStreamers()
    this.settings = await getSettings()
    const auth = await getAuth()

    await pruneRuntime(new Set(this.streamers.map((s) => s.id)))

    const tokenValid = !!auth.twitch && auth.twitch.expiresAt > Date.now()
    const token = tokenValid ? auth.twitch!.accessToken : ''
    this.twitch.setCredentials(this.settings.twitchClientId, token)

    const twTargets = this.enabledLogins('twitch')
    const kiTargets = this.enabledLogins('kick')
    this.twitch.setTargets(twTargets)
    this.kick.setTargets(kiTargets)

    this.twitch.start()
    this.kick.start()

    // Disabled streamers are not watched -> mark them idle.
    for (const s of this.streamers) {
      if (!s.enabled) await patchRuntime(s.id, { status: 'idle' })
    }
    // If Twitch has channels but no credentials, surface that.
    if (twTargets.length > 0 && !this.twitch.hasCredentials()) {
      for (const s of this.streamers) {
        if (s.platform === 'twitch' && s.enabled) {
          await patchRuntime(s.id, { status: 'error', error: 'Connecte ton compte Twitch.' })
        }
      }
    }
    await this.refreshBadge()
  }

  checkHealth(): void {
    this.twitch.checkHealth()
    this.kick.checkHealth()
  }

  private enabledLogins(platform: Platform): string[] {
    return this.streamers
      .filter((s) => s.platform === platform && s.enabled)
      .map((s) => s.login)
  }

  private find(platform: Platform, login: string): Streamer | undefined {
    const l = login.toLowerCase()
    return this.streamers.find((s) => s.platform === platform && s.login === l)
  }

  private handleLive = async (u: LiveUpdate): Promise<void> => {
    const s = this.find(u.platform, u.login)
    if (!s) return
    const rt = await getRuntime()
    const wasLive = rt[s.id]?.isLive ?? false

    await patchRuntime(s.id, {
      isLive: u.isLive,
      title: u.title,
      category: u.category,
      platformId: u.platformId,
      status: 'watching',
      lastChangedAt: Date.now(),
    })

    if (shouldNotify({ wasLive, isLive: u.isLive, initial: u.initial, enabled: s.enabled })) {
      createLiveNotification(s, u)
      if (this.settings.soundEnabled && s.soundEnabled) {
        await playAlert(this.settings.soundVolume)
      }
    }
    await this.refreshBadge()
  }

  private handleResolved = async (
    platform: Platform,
    login: string,
    platformId: string,
  ): Promise<void> => {
    const s = this.find(platform, login)
    if (s) await patchRuntime(s.id, { platformId })
  }

  private handleStatus = async (
    platform: Platform,
    login: string | '*',
    status: StreamerRuntime['status'],
    error?: string,
  ): Promise<void> => {
    const apply = async (s: Streamer) => {
      await patchRuntime(s.id, { status, error: status === 'error' ? error : undefined })
    }
    if (login === '*') {
      for (const s of this.streamers) {
        if (s.platform === platform && s.enabled) await apply(s)
      }
    } else {
      const s = this.find(platform, login)
      if (s) await apply(s)
    }
  }

  private async refreshBadge(): Promise<void> {
    const rt = await getRuntime()
    const count = this.streamers.filter((s) => rt[s.id]?.isLive).length
    await updateBadge(count, this.settings.showBadge)
  }

  /** Test/diagnostic hook: push a synthetic live event through the full path. */
  async simulateLive(platform: Platform, login: string, isLive: boolean): Promise<void> {
    log.info('simulateLive', platform, login, isLive)
    await this.handleLive({
      platform,
      login,
      isLive,
      title: isLive ? 'Stream de test' : undefined,
      category: isLive ? 'Just Chatting' : undefined,
    })
  }
}
