export interface KickChannel {
  channelId: number
  displayName: string
  /** Whether the channel is live right now (from the snapshot at resolve time). */
  isLive: boolean
  title?: string
  category?: string
}

/**
 * Resolve a Kick channel slug -> channel id. This is a single, one-time lookup
 * (not polling): the channel id is then used to subscribe to the Pusher channel
 * `channel.<id>` for real-time live events.
 */
export async function resolveKickChannel(slug: string): Promise<KickChannel | null> {
  const res = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`, {
    headers: { Accept: 'application/json' },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Kick channel lookup HTTP ${res.status}`)
  const j = (await res.json()) as {
    id?: number
    slug?: string
    user?: { username?: string }
    livestream?: { session_title?: string; categories?: Array<{ name?: string }> } | null
  }
  if (!j.id) return null
  const live = j.livestream ?? null
  return {
    channelId: j.id,
    displayName: j.user?.username || j.slug || slug,
    isLive: !!live,
    title: live?.session_title,
    category: live?.categories?.[0]?.name,
  }
}
