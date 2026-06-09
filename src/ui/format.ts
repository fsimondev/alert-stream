export function timeAgo(ms: number, now: number = Date.now()): string {
  if (!ms) return ''
  const sec = Math.max(0, Math.round((now - ms) / 1000))
  if (sec < 60) return "à l'instant"
  const min = Math.round(sec / 60)
  if (min < 60) return `il y a ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.round(h / 24)
  return `il y a ${d} j`
}

export function initialOf(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase()
}
