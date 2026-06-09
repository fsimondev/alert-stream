import { parseStreamInput } from '../lib/parse-input'
import {
  getAuth,
  getSettings,
  getStreamers,
  setAuth,
  setStreamers,
} from '../lib/storage'
import {
  findDuplicate,
  makeStreamer,
  removeStreamer,
  updateStreamer,
} from '../lib/streamers'
import { getRedirectUrl, launchTwitchAuth, validateToken } from '../lib/twitch/api'
import type { Message, MessageResponse } from '../lib/messaging'
import { playAlert } from './effects'
import type { Engine } from './engine'

/**
 * Handles UI -> background intents. All persistent mutations go through
 * chrome.storage; the engine reconciles afterwards so the watchers reflect the
 * new desired state.
 */
export async function handleCommand(engine: Engine, msg: Message): Promise<MessageResponse> {
  switch (msg.type) {
    case 'ADD_STREAMER': {
      const parsed = parseStreamInput(msg.input, msg.hint)
      if (!parsed) {
        return { ok: false, error: 'Entrée invalide. Colle une URL Twitch/Kick ou un pseudo.' }
      }
      const list = await getStreamers()
      if (findDuplicate(list, parsed)) {
        return { ok: false, error: 'Cette chaîne est déjà dans ta liste.' }
      }
      const streamer = makeStreamer(parsed, crypto.randomUUID(), Date.now())
      await setStreamers([...list, streamer])
      await engine.reconcile()
      return { ok: true, id: streamer.id }
    }

    case 'REMOVE_STREAMER': {
      const list = await getStreamers()
      await setStreamers(removeStreamer(list, msg.id))
      await engine.reconcile()
      return { ok: true }
    }

    case 'SET_STREAMER_ENABLED': {
      const list = await getStreamers()
      await setStreamers(updateStreamer(list, msg.id, { enabled: msg.enabled }))
      await engine.reconcile()
      return { ok: true }
    }

    case 'SET_STREAMER_SOUND': {
      const list = await getStreamers()
      await setStreamers(updateStreamer(list, msg.id, { soundEnabled: msg.soundEnabled }))
      return { ok: true }
    }

    case 'CONNECT_TWITCH': {
      const settings = await getSettings()
      const clientId = settings.twitchClientId.trim()
      if (!clientId) {
        return { ok: false, error: 'Renseigne d’abord ton Client ID Twitch.' }
      }
      try {
        const { accessToken } = await launchTwitchAuth(clientId)
        const v = await validateToken(accessToken)
        if (v.clientId !== clientId) {
          return { ok: false, error: 'Le token ne correspond pas à ce Client ID.' }
        }
        const auth = await getAuth()
        auth.twitch = {
          accessToken,
          obtainedAt: Date.now(),
          expiresAt: Date.now() + v.expiresIn * 1000,
          login: v.login,
          userId: v.userId,
        }
        await setAuth(auth)
        await engine.reconcile()
        return { ok: true, login: v.login }
      } catch (e) {
        return { ok: false, error: String((e as Error).message ?? e) }
      }
    }

    case 'DISCONNECT_TWITCH': {
      const auth = await getAuth()
      delete auth.twitch
      await setAuth(auth)
      await engine.reconcile()
      return { ok: true }
    }

    case 'RECONCILE': {
      await engine.reconcile()
      return { ok: true }
    }

    case 'TEST_SOUND': {
      const settings = await getSettings()
      await playAlert(settings.soundVolume)
      return { ok: true }
    }

    case 'GET_REDIRECT_URL': {
      return { ok: true, url: getRedirectUrl() }
    }

    case '__SIMULATE_LIVE': {
      await engine.simulateLive(msg.platform, msg.login, msg.isLive)
      return { ok: true }
    }

    default:
      return { ok: false, error: 'Commande inconnue.' }
  }
}
