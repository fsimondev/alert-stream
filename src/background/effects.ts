import { channelUrl } from '../lib/parse-input'
import { log } from '../lib/log'
import type { Settings, Streamer } from '../lib/types'
import { liveBadgeText } from './decide'
import type { LiveUpdate } from './watcher-types'

/** Notification id == channel URL, so the click handler can open it directly
 *  even after the service worker has been restarted. */
export function notificationIdFor(streamer: Streamer): string {
  return channelUrl(streamer.platform, streamer.login)
}

export function createLiveNotification(streamer: Streamer, update: LiveUpdate): void {
  const platformLabel = streamer.platform === 'twitch' ? 'Twitch' : 'Kick'
  const bits = [update.title, update.category ? `· ${update.category}` : '']
    .filter(Boolean)
    .join(' ')
    .trim()
  chrome.notifications.create(notificationIdFor(streamer), {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
    title: `🔴 ${streamer.displayName} est en live !`,
    message: bits || `En direct sur ${platformLabel}`,
    contextMessage: platformLabel,
    priority: 2,
  })
}

export async function updateBadge(count: number, show: boolean): Promise<void> {
  const text = liveBadgeText(count, show)
  try {
    await chrome.action.setBadgeText({ text })
    await chrome.action.setBadgeBackgroundColor({ color: '#ff3b5c' })
    if (chrome.action.setBadgeTextColor) {
      await chrome.action.setBadgeTextColor({ color: '#ffffff' })
    }
  } catch (e) {
    log.warn('badge update failed', e)
  }
}

/* -------------------------- offscreen audio ----------------------------- */

const OFFSCREEN_URL = 'offscreen.html'
let creating: Promise<void> | null = null

async function hasOffscreenDocument(): Promise<boolean> {
  // hasDocument() is not in every Chrome version; fall back to getContexts.
  const off = chrome.offscreen as unknown as { hasDocument?: () => Promise<boolean> }
  if (typeof off.hasDocument === 'function') return off.hasDocument()
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType],
  })
  return contexts.length > 0
}

async function ensureOffscreen(): Promise<void> {
  if (await hasOffscreenDocument()) return
  if (creating) {
    await creating
    return
  }
  creating = chrome.offscreen
    .createDocument({
      url: OFFSCREEN_URL,
      reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: 'Jouer le son d’alerte des notifications de live.',
    })
    .catch((e) => {
      // Another caller may have created it first; ignore the race.
      log.warn('offscreen create', e)
    })
    .finally(() => {
      creating = null
    })
  await creating
}

export async function playAlert(volume: number): Promise<void> {
  try {
    await ensureOffscreen()
    await chrome.runtime.sendMessage({ target: 'offscreen', type: 'PLAY_SOUND', volume })
  } catch (e) {
    log.warn('playAlert failed', e)
  }
}

export type { Settings }
