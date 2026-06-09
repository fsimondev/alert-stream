import { useState } from 'react'
import clsx from 'clsx'
import {
  AlertTriangle,
  Bell,
  BellOff,
  ExternalLink,
  Loader2,
  Plus,
  Trash2,
  Twitch as TwitchIcon,
} from 'lucide-react'
import { channelUrl } from '../lib/parse-input'
import { sendMessage } from '../lib/messaging'
import type { AddStreamerResult } from '../lib/messaging'
import type { Platform, Streamer, StreamerRuntime } from '../lib/types'
import { initialOf, timeAgo } from './format'

/* ------------------------------- atoms ---------------------------------- */

export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={clsx('relative inline-flex h-2.5 w-2.5', className)}>
      <span className="absolute inline-flex h-full w-full rounded-full bg-live opacity-70 animate-ping" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-live" />
    </span>
  )
}

export function PlatformBadge({ platform }: { platform: Platform }) {
  if (platform === 'twitch') {
    return (
      <span className="chip bg-twitch/15 text-twitch-glow">
        <TwitchIcon size={11} /> Twitch
      </span>
    )
  }
  return (
    <span className="chip bg-kick/15 text-kick-glow">
      <span className="font-black">K</span> Kick
    </span>
  )
}

export function Avatar({ streamer, live }: { streamer: Streamer; live: boolean }) {
  const ring = streamer.platform === 'twitch' ? 'ring-twitch/50' : 'ring-kick/50'
  const bg =
    streamer.platform === 'twitch'
      ? 'bg-gradient-to-br from-twitch/30 to-fuchsia-700/30 text-twitch-glow'
      : 'bg-gradient-to-br from-kick/25 to-emerald-700/25 text-kick-glow'
  return (
    <div className="relative shrink-0">
      <div
        className={clsx(
          'grid h-10 w-10 place-items-center rounded-xl text-base font-bold ring-1',
          bg,
          live ? ring : 'ring-white/10',
        )}
      >
        {initialOf(streamer.displayName)}
      </div>
      {live && (
        <span className="absolute -right-1 -top-1 rounded-full bg-ink-900 p-0.5">
          <LiveDot />
        </span>
      )}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  accent = 'twitch',
  testId,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  accent?: 'twitch' | 'kick'
  testId?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-testid={testId}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative h-5 w-9 shrink-0 rounded-full transition-colors',
        checked ? (accent === 'twitch' ? 'bg-twitch' : 'bg-kick') : 'bg-ink-600',
      )}
    >
      <span
        className={clsx(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all',
          checked ? 'left-[18px]' : 'left-0.5',
        )}
      />
    </button>
  )
}

/* --------------------------- status line -------------------------------- */

function StatusLine({ rt, enabled }: { rt?: StreamerRuntime; enabled: boolean }) {
  if (!enabled) return <span className="text-slate-500">En pause</span>
  if (!rt) return <span className="text-slate-500">…</span>
  if (rt.isLive) {
    return (
      <span className="truncate text-live">
        {rt.title ? rt.title : 'En direct'}
        {rt.category ? <span className="text-slate-400"> · {rt.category}</span> : null}
      </span>
    )
  }
  switch (rt.status) {
    case 'connecting':
      return (
        <span className="inline-flex items-center gap-1 text-slate-400">
          <Loader2 size={12} className="animate-spin" /> Connexion…
        </span>
      )
    case 'error':
      return (
        <span className="inline-flex items-center gap-1 text-amber-400">
          <AlertTriangle size={12} /> {rt.error ?? 'Erreur'}
        </span>
      )
    case 'watching':
      return <span className="text-slate-500">Hors ligne · surveillé</span>
    default:
      return <span className="text-slate-500">En attente</span>
  }
}

/* --------------------------- streamer item ------------------------------ */

export function StreamerItem({
  streamer,
  rt,
  compact = false,
}: {
  streamer: Streamer
  rt?: StreamerRuntime
  compact?: boolean
}) {
  const live = !!rt?.isLive && streamer.enabled
  const url = channelUrl(streamer.platform, streamer.login)

  const remove = () => void sendMessage({ type: 'REMOVE_STREAMER', id: streamer.id })
  const toggleEnabled = (v: boolean) =>
    void sendMessage({ type: 'SET_STREAMER_ENABLED', id: streamer.id, enabled: v })
  const toggleSound = (v: boolean) =>
    void sendMessage({ type: 'SET_STREAMER_SOUND', id: streamer.id, soundEnabled: v })

  return (
    <li
      data-testid="streamer-item"
      data-login={streamer.login}
      data-platform={streamer.platform}
      data-live={live ? 'true' : 'false'}
      className={clsx(
        'group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition animate-fade-in',
        live
          ? 'border-live/30 bg-live/[0.06] shadow-glow-live'
          : 'border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04]',
      )}
    >
      <Avatar streamer={streamer} live={live} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="truncate font-semibold text-slate-100 hover:text-white"
            title={`Ouvrir ${streamer.displayName}`}
          >
            {streamer.displayName}
          </a>
          <PlatformBadge platform={streamer.platform} />
          {live && (
            <span className="chip bg-live/20 text-live">
              <LiveDot /> LIVE
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs">
          <StatusLine rt={rt} enabled={streamer.enabled} />
          {live && rt?.lastChangedAt ? (
            <span className="shrink-0 text-slate-600">· {timeAgo(rt.lastChangedAt)}</span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {!compact && (
          <button
            type="button"
            className="btn-danger btn h-8 w-8 !px-0"
            title={streamer.soundEnabled ? 'Couper le son' : 'Activer le son'}
            data-testid="streamer-sound"
            onClick={() => toggleSound(!streamer.soundEnabled)}
          >
            {streamer.soundEnabled ? <Bell size={15} /> : <BellOff size={15} />}
          </button>
        )}
        <Toggle
          checked={streamer.enabled}
          onChange={toggleEnabled}
          label={`Notifications pour ${streamer.displayName}`}
          accent={streamer.platform}
          testId="streamer-enabled"
        />
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="btn-ghost btn h-8 w-8 !px-0"
          title="Ouvrir la chaîne"
        >
          <ExternalLink size={15} />
        </a>
        <button
          type="button"
          className="btn-danger btn h-8 w-8 !px-0"
          title="Supprimer"
          data-testid="streamer-remove"
          onClick={remove}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </li>
  )
}

/* ------------------------------ add form -------------------------------- */

export function AddForm({ autoFocus = false }: { autoFocus?: boolean }) {
  const [platform, setPlatform] = useState<Platform>('twitch')
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim() || busy) return
    setBusy(true)
    setError('')
    const res = await sendMessage<AddStreamerResult>({
      type: 'ADD_STREAMER',
      input: value.trim(),
      hint: platform,
    })
    setBusy(false)
    if (res?.ok) setValue('')
    else setError(res?.error ?? 'Erreur inconnue.')
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex gap-1.5">
        <PlatformPick value={platform} onChange={setPlatform} />
      </div>
      <div className="flex gap-2">
        <input
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={autoFocus}
          data-testid="add-input"
          className="input"
          placeholder={
            platform === 'twitch' ? 'twitch.tv/pseudo ou pseudo' : 'kick.com/pseudo ou pseudo'
          }
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            if (error) setError('')
          }}
        />
        <button
          type="submit"
          data-testid="add-submit"
          disabled={busy || !value.trim()}
          className={clsx('btn shrink-0', platform === 'twitch' ? 'btn-primary' : 'btn-kick')}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Ajouter
        </button>
      </div>
      {error && (
        <p data-testid="add-error" className="text-xs text-amber-400">
          {error}
        </p>
      )}
    </form>
  )
}

function PlatformPick({
  value,
  onChange,
}: {
  value: Platform
  onChange: (p: Platform) => void
}) {
  const opt = (p: Platform, label: string) => (
    <button
      type="button"
      data-testid={`platform-${p}`}
      aria-pressed={value === p}
      onClick={() => onChange(p)}
      className={clsx(
        'btn flex-1',
        value === p
          ? p === 'twitch'
            ? 'btn-primary'
            : 'btn-kick'
          : 'btn-ghost',
      )}
    >
      {p === 'twitch' ? <TwitchIcon size={14} /> : <span className="font-black">K</span>}
      {label}
    </button>
  )
  return (
    <>
      {opt('twitch', 'Twitch')}
      {opt('kick', 'Kick')}
    </>
  )
}

/* ----------------------------- empty state ------------------------------ */

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">
      {children}
    </div>
  )
}
