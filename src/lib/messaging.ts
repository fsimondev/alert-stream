import type { Platform } from './types'

/**
 * Typed message protocol between UI (popup/options) and the background worker.
 * The background owns all WebSocket connections; the UI sends intents and reads
 * derived state from chrome.storage.
 */
export type Message =
  | { type: 'ADD_STREAMER'; input: string; hint?: Platform }
  | { type: 'REMOVE_STREAMER'; id: string }
  | { type: 'SET_STREAMER_ENABLED'; id: string; enabled: boolean }
  | { type: 'SET_STREAMER_SOUND'; id: string; soundEnabled: boolean }
  | { type: 'CONNECT_TWITCH' }
  | { type: 'DISCONNECT_TWITCH' }
  | { type: 'RECONCILE' }
  | { type: 'TEST_SOUND' }
  | { type: 'GET_REDIRECT_URL' }
  // Test-only hook: simulate a live event end-to-end (guarded, see engine).
  | { type: '__SIMULATE_LIVE'; login: string; platform: Platform; isLive: boolean }

export interface AddStreamerResult {
  ok: boolean
  error?: string
  id?: string
}

export interface ConnectTwitchResult {
  ok: boolean
  error?: string
  login?: string
}

export type MessageResponse =
  | { ok: true; [k: string]: unknown }
  | { ok: false; error: string }

/** Promise-based wrapper over chrome.runtime.sendMessage. */
export function sendMessage<R = MessageResponse>(msg: Message): Promise<R> {
  return chrome.runtime.sendMessage(msg) as Promise<R>
}
