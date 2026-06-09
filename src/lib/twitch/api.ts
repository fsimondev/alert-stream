import { TWITCH_HELIX, TWITCH_OAUTH } from './messages'

export interface TwitchTokenInfo {
  accessToken: string
  scopes: string[]
}

export interface TwitchValidation {
  clientId: string
  login: string
  userId: string
  expiresIn: number // seconds
}

/** chrome.identity redirect target (https://<id>.chromiumapp.org/). */
export function getRedirectUrl(): string {
  return chrome.identity.getRedirectURL()
}

/**
 * Build the Twitch implicit-grant authorize URL. No client secret is needed;
 * the access token is returned in the redirect fragment.
 * `stream.online`/`stream.offline` need no scope, only a valid user token.
 */
export function buildAuthUrl(clientId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: '',
    force_verify: 'true',
  })
  return `${TWITCH_OAUTH}/authorize?${params.toString()}`
}

/** Extract the access token from the OAuth redirect URL fragment. Pure. */
export function parseTokenFromRedirect(redirectUrl: string): TwitchTokenInfo | null {
  let hash = ''
  try {
    hash = new URL(redirectUrl).hash
  } catch {
    const idx = redirectUrl.indexOf('#')
    hash = idx >= 0 ? redirectUrl.slice(idx) : ''
  }
  if (!hash) return null
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const accessToken = params.get('access_token')
  if (!accessToken) return null
  return {
    accessToken,
    scopes: (params.get('scope') ?? '').split(' ').filter(Boolean),
  }
}

/** Run the interactive OAuth flow and return the access token. */
export async function launchTwitchAuth(clientId: string): Promise<TwitchTokenInfo> {
  const redirectUri = getRedirectUrl()
  const authUrl = buildAuthUrl(clientId, redirectUri)
  const redirect = await chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true })
  if (!redirect) throw new Error('Authentification annulée.')
  const token = parseTokenFromRedirect(redirect)
  if (!token) throw new Error('Token introuvable dans la réponse OAuth.')
  return token
}

export async function validateToken(token: string): Promise<TwitchValidation> {
  const res = await fetch(`${TWITCH_OAUTH}/validate`, {
    headers: { Authorization: `OAuth ${token}` },
  })
  if (!res.ok) throw new Error(`Token Twitch invalide (HTTP ${res.status}).`)
  const j = (await res.json()) as {
    client_id: string
    login: string
    user_id: string
    expires_in: number
  }
  return {
    clientId: j.client_id,
    login: j.login,
    userId: j.user_id,
    expiresIn: j.expires_in,
  }
}

function helixHeaders(clientId: string, token: string): HeadersInit {
  return { 'Client-Id': clientId, Authorization: `Bearer ${token}` }
}

/** Resolve a login -> { id, displayName }. Returns null if not found. */
export async function getUser(
  clientId: string,
  token: string,
  login: string,
): Promise<{ id: string; displayName: string } | null> {
  const res = await fetch(`${TWITCH_HELIX}/users?login=${encodeURIComponent(login)}`, {
    headers: helixHeaders(clientId, token),
  })
  if (!res.ok) throw new Error(`Helix users HTTP ${res.status}`)
  const j = (await res.json()) as { data: Array<{ id: string; display_name: string }> }
  const u = j.data?.[0]
  return u ? { id: u.id, displayName: u.display_name } : null
}

/** Fetch current stream title/category for enrichment (single, event-driven call). */
export async function getStreamInfo(
  clientId: string,
  token: string,
  userId: string,
): Promise<{ title?: string; category?: string } | null> {
  const res = await fetch(`${TWITCH_HELIX}/streams?user_id=${encodeURIComponent(userId)}`, {
    headers: helixHeaders(clientId, token),
  })
  if (!res.ok) return null
  const j = (await res.json()) as {
    data: Array<{ title?: string; game_name?: string }>
  }
  const s = j.data?.[0]
  if (!s) return null
  return { title: s.title, category: s.game_name }
}

export async function createSubscription(
  clientId: string,
  token: string,
  sessionId: string,
  type: 'stream.online' | 'stream.offline',
  broadcasterUserId: string,
): Promise<string> {
  const res = await fetch(`${TWITCH_HELIX}/eventsub/subscriptions`, {
    method: 'POST',
    headers: { ...helixHeaders(clientId, token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type,
      version: '1',
      condition: { broadcaster_user_id: broadcasterUserId },
      transport: { method: 'websocket', session_id: sessionId },
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`EventSub subscribe ${type} HTTP ${res.status} ${text}`)
  }
  const j = (await res.json()) as { data: Array<{ id: string }> }
  return j.data?.[0]?.id ?? ''
}

export async function deleteSubscription(
  clientId: string,
  token: string,
  subId: string,
): Promise<void> {
  await fetch(`${TWITCH_HELIX}/eventsub/subscriptions?id=${encodeURIComponent(subId)}`, {
    method: 'DELETE',
    headers: helixHeaders(clientId, token),
  }).catch(() => undefined)
}
