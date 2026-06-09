import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BadgeCheck,
  Check,
  Copy,
  ExternalLink,
  LogOut,
  MousePointerClick,
  Radio,
  ShieldCheck,
  Volume2,
} from 'lucide-react'
import { getRedirectUrl } from '../lib/twitch/api'
import { DEFAULT_TWITCH_CLIENT_ID } from '../lib/config'
import { sendMessage } from '../lib/messaging'
import type { ConnectTwitchResult } from '../lib/messaging'
import { setSettings } from '../lib/storage'
import type { Settings, Streamer, StreamerRuntime } from '../lib/types'
import { AddForm, EmptyState, PlatformBadge, StreamerItem, Toggle } from '../ui/components'
import { useAuth, useRuntime, useSettings, useStreamers } from '../ui/state'

function order(streamers: Streamer[], rt: Record<string, StreamerRuntime>): Streamer[] {
  return [...streamers].sort((a, b) => {
    const la = rt[a.id]?.isLive && a.enabled ? 1 : 0
    const lb = rt[b.id]?.isLive && b.enabled ? 1 : 0
    if (la !== lb) return lb - la
    return a.displayName.localeCompare(b.displayName)
  })
}

export function Options() {
  const streamers = useStreamers()
  const runtime = useRuntime()
  const settings = useSettings()
  const ordered = useMemo(() => order(streamers, runtime), [streamers, runtime])

  return (
    <div className="aurora min-h-screen px-4 py-10">
      <div className="relative z-10 mx-auto max-w-2xl space-y-6">
        <header className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-twitch to-kick text-ink-950 shadow-glow-twitch">
            <Radio size={22} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">LiveWatch — Réglages</h1>
            <p className="text-sm text-slate-500">
              Notifications temps réel quand un stream démarre. Push pur, zéro polling.
            </p>
          </div>
        </header>

        <TwitchCard settings={settings} />
        <SettingsCard settings={settings} />

        <section className="card space-y-3 p-5">
          <h2 className="text-sm font-semibold text-slate-300">Ajouter une chaîne</h2>
          <AddForm />
        </section>

        <section className="card space-y-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300">
              Chaînes surveillées ({streamers.length})
            </h2>
          </div>
          {ordered.length === 0 ? (
            <EmptyState>Aucune chaîne. Ajoute Twitch ou Kick ci-dessus.</EmptyState>
          ) : (
            <ul data-testid="streamer-list" className="space-y-1.5">
              {ordered.map((s) => (
                <StreamerItem key={s.id} streamer={s} rt={runtime[s.id]} />
              ))}
            </ul>
          )}
        </section>

        <p className="pb-6 text-center text-xs text-slate-600">
          LiveWatch · les connexions sont des WebSockets push : Twitch EventSub (officiel) &amp;
          Kick Pusher.
        </p>
      </div>
    </div>
  )
}

/* ----------------------------- Twitch card ------------------------------ */

function TwitchCard({ settings }: { settings: Settings }) {
  const auth = useAuth()
  const [clientId, setClientId] = useState(settings.twitchClientId)
  const [redirect, setRedirect] = useState('')
  const [copied, setCopied] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')
  const firstLoad = useRef(true)

  // Keep local field in sync if settings load after first render.
  useEffect(() => {
    if (firstLoad.current) {
      setClientId(settings.twitchClientId)
      firstLoad.current = false
    }
  }, [settings.twitchClientId])

  useEffect(() => {
    try {
      setRedirect(getRedirectUrl())
    } catch {
      setRedirect('')
    }
  }, [])

  // Debounced persist of the client id.
  useEffect(() => {
    if (firstLoad.current) return
    const t = setTimeout(() => {
      if (clientId !== settings.twitchClientId) {
        void setSettings({ ...settings, twitchClientId: clientId.trim() })
      }
    }, 500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  const connected = !!auth.twitch && auth.twitch.expiresAt > Date.now()
  const expired = !!auth.twitch && auth.twitch.expiresAt <= Date.now()
  // When a Client ID is baked into the build, users just click "Se connecter".
  const baked = DEFAULT_TWITCH_CLIENT_ID.length > 0

  const connect = async () => {
    setError('')
    setConnecting(true)
    // Make sure the latest client id is persisted before launching OAuth.
    await setSettings({ ...settings, twitchClientId: clientId.trim() })
    const res = await sendMessage<ConnectTwitchResult>({ type: 'CONNECT_TWITCH' })
    setConnecting(false)
    if (!res?.ok) setError(res?.error ?? 'Échec de la connexion.')
  }

  const disconnect = () => void sendMessage({ type: 'DISCONNECT_TWITCH' })

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(redirect)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard may be blocked; the field is selectable anyway */
    }
  }

  const fieldClientId = (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-slate-400">Client ID</span>
      <input
        data-testid="twitch-client-id"
        className="input font-mono"
        placeholder="ex : gp762nuuoqcoxypju8c569th9wz7q5"
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
      />
    </label>
  )

  const fieldRedirect = (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-slate-400">
        URL de redirection (à enregistrer dans l’app Twitch)
      </span>
      <div className="flex gap-2">
        <input readOnly className="input font-mono text-xs" value={redirect} />
        <button type="button" className="btn-ghost btn shrink-0" onClick={copy}>
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? 'Copié' : 'Copier'}
        </button>
      </div>
    </label>
  )

  return (
    <section className="card space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-300">
          <PlatformBadge platform="twitch" /> Connexion Twitch
        </h2>
        {connected ? (
          <span className="chip bg-kick/15 text-kick-glow" data-testid="twitch-connected">
            <BadgeCheck size={13} /> {auth.twitch?.login}
          </span>
        ) : (
          <span className="chip bg-white/5 text-slate-400">Non connecté</span>
        )}
      </div>

      {connected ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-slate-400">
            Connecté en tant que <b className="text-slate-200">{auth.twitch?.login}</b>. Les alertes
            Twitch sont actives.
          </p>
          <button type="button" className="btn-ghost btn" onClick={disconnect}>
            <LogOut size={15} /> Déconnecter
          </button>
        </div>
      ) : (
        <>
          {baked ? (
            <p className="text-sm text-slate-400">
              Clique pour autoriser LiveWatch sur ton compte Twitch : une page Twitch s’ouvre, tu
              valides, et c’est terminé.
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-xs leading-relaxed text-slate-500">
                Twitch EventSub exige un <b>Client ID</b> d’application (gratuit, une seule fois).
                Crée une app sur{' '}
                <a
                  href="https://dev.twitch.tv/console/apps/create"
                  target="_blank"
                  rel="noreferrer"
                  className="text-twitch-glow hover:underline"
                >
                  dev.twitch.tv/console <ExternalLink size={11} className="inline" />
                </a>
                , colle l’URL de redirection ci-dessous dans « OAuth Redirect URLs », puis colle le
                Client ID ici.
              </p>
              {fieldClientId}
              {fieldRedirect}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="twitch-connect"
              className="btn-primary btn"
              disabled={connecting || !clientId.trim()}
              onClick={connect}
            >
              <ShieldCheck size={15} /> {connecting ? 'Connexion…' : 'Se connecter avec Twitch'}
            </button>
            {expired && (
              <span className="text-xs text-amber-400">Session expirée, reconnecte-toi.</span>
            )}
            {error && <span className="text-xs text-amber-400">{error}</span>}
          </div>

          {baked && (
            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer select-none hover:text-slate-300">
                Avancé : utiliser un autre Client ID
              </summary>
              <div className="mt-3 space-y-3">
                {fieldClientId}
                {fieldRedirect}
              </div>
            </details>
          )}
        </>
      )}

      <p className="text-[11px] text-slate-600">
        Kick ne nécessite aucune connexion : le suivi se fait via son flux public en temps réel.
      </p>
    </section>
  )
}

/* ---------------------------- settings card ----------------------------- */

function SettingRow({
  icon,
  title,
  desc,
  children,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-slate-400">{icon}</div>
        <div>
          <p className="text-sm font-medium text-slate-200">{title}</p>
          <p className="text-xs text-slate-500">{desc}</p>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function SettingsCard({ settings }: { settings: Settings }) {
  const [volume, setVolume] = useState(settings.soundVolume)
  const volumeLoaded = useRef(false)

  useEffect(() => {
    if (!volumeLoaded.current) {
      setVolume(settings.soundVolume)
      volumeLoaded.current = true
    }
  }, [settings.soundVolume])

  useEffect(() => {
    if (!volumeLoaded.current) return
    const t = setTimeout(() => {
      if (volume !== settings.soundVolume) void setSettings({ ...settings, soundVolume: volume })
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume])

  const update = (patch: Partial<Settings>) => void setSettings({ ...settings, ...patch })

  return (
    <section className="card divide-y divide-white/5 p-5">
      <h2 className="pb-2 text-sm font-semibold text-slate-300">Notifications</h2>

      <SettingRow
        icon={<Volume2 size={18} />}
        title="Son d’alerte"
        desc="Jouer un son quand une chaîne passe en live."
      >
        <Toggle
          checked={settings.soundEnabled}
          onChange={(v) => update({ soundEnabled: v })}
          label="Son d'alerte"
          testId="setting-sound"
        />
      </SettingRow>

      <div className="flex items-center justify-between gap-4 py-2.5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-slate-400">
            <Volume2 size={18} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-200">Volume</p>
            <p className="text-xs text-slate-500">{Math.round(volume * 100)} %</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            disabled={!settings.soundEnabled}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-32 accent-twitch disabled:opacity-40"
          />
          <button
            type="button"
            className="btn-ghost btn"
            disabled={!settings.soundEnabled}
            onClick={() => void sendMessage({ type: 'TEST_SOUND' })}
          >
            Tester
          </button>
        </div>
      </div>

      <SettingRow
        icon={<MousePointerClick size={18} />}
        title="Ouvrir au clic"
        desc="Ouvrir la chaîne dans un onglet quand on clique la notification."
      >
        <Toggle
          checked={settings.openOnClick}
          onChange={(v) => update({ openOnClick: v })}
          label="Ouvrir au clic"
          testId="setting-open"
        />
      </SettingRow>

      <SettingRow
        icon={<BadgeCheck size={18} />}
        title="Badge sur l’icône"
        desc="Afficher le nombre de chaînes en direct sur l’icône."
      >
        <Toggle
          checked={settings.showBadge}
          onChange={(v) => update({ showBadge: v })}
          label="Badge sur l'icône"
          testId="setting-badge"
        />
      </SettingRow>
    </section>
  )
}
