import { useMemo } from 'react'
import { Radio, Settings } from 'lucide-react'
import { AddForm, EmptyState, StreamerItem } from '../ui/components'
import { liveCount, useRuntime, useSettings, useStreamers } from '../ui/state'
import type { Streamer, StreamerRuntime } from '../lib/types'

function order(streamers: Streamer[], rt: Record<string, StreamerRuntime>): Streamer[] {
  return [...streamers].sort((a, b) => {
    const la = rt[a.id]?.isLive && a.enabled ? 1 : 0
    const lb = rt[b.id]?.isLive && b.enabled ? 1 : 0
    if (la !== lb) return lb - la
    return a.displayName.localeCompare(b.displayName)
  })
}

export function Popup() {
  const streamers = useStreamers()
  const runtime = useRuntime()
  const settings = useSettings()
  const live = liveCount(streamers, runtime)
  const ordered = useMemo(() => order(streamers, runtime), [streamers, runtime])
  const needsTwitch =
    streamers.some((s) => s.platform === 'twitch' && s.enabled) && !settings.twitchClientId

  return (
    <div className="aurora w-[384px] p-4">
      <div className="relative z-10 space-y-4">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-twitch to-kick text-ink-950 shadow-glow-twitch">
              <Radio size={18} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-[15px] font-bold leading-tight tracking-tight">LiveWatch</h1>
              <p className="text-[11px] text-slate-500">Twitch &amp; Kick · temps réel</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              data-testid="live-count"
              className="chip bg-live/15 text-live"
              title="Chaînes en direct"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-live" />
              {live} live
            </span>
            <button
              type="button"
              title="Réglages"
              data-testid="open-options"
              className="btn-ghost btn h-9 w-9 !px-0"
              onClick={() => chrome.runtime.openOptionsPage()}
            >
              <Settings size={16} />
            </button>
          </div>
        </header>

        <AddForm autoFocus />

        {needsTwitch && (
          <button
            type="button"
            onClick={() => chrome.runtime.openOptionsPage()}
            className="w-full rounded-xl border border-twitch/30 bg-twitch/10 px-3 py-2 text-left text-xs text-twitch-glow hover:bg-twitch/15"
          >
            ⚙️ Connecte ton compte Twitch dans les réglages pour activer les alertes Twitch.
          </button>
        )}

        <section>
          {ordered.length === 0 ? (
            <EmptyState>
              Aucune chaîne pour le moment.
              <br />
              Ajoute un streamer Twitch ou Kick ci-dessus 👆
            </EmptyState>
          ) : (
            <ul data-testid="streamer-list" className="space-y-1.5">
              {ordered.map((s) => (
                <StreamerItem key={s.id} streamer={s} rt={runtime[s.id]} compact />
              ))}
            </ul>
          )}
        </section>

        <footer className="flex items-center justify-between pt-1 text-[11px] text-slate-600">
          <span>
            {streamers.length} chaîne{streamers.length > 1 ? 's' : ''} surveillée
            {streamers.length > 1 ? 's' : ''}
          </span>
          <button
            type="button"
            className="hover:text-slate-400"
            onClick={() => chrome.runtime.openOptionsPage()}
          >
            Réglages avancés →
          </button>
        </footer>
      </div>
    </div>
  )
}
