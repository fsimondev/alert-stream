/** Pure decision helpers for the engine — easy to unit test in isolation. */

export interface NotifyDecisionInput {
  /** Previous known live state. */
  wasLive: boolean
  /** New live state from the event. */
  isLive: boolean
  /** True for a startup snapshot (must not notify). */
  initial?: boolean
  /** Whether notifications are enabled for this streamer. */
  enabled: boolean
}

/** A notification (and sound) should fire only on a genuine off->on transition
 *  for an enabled streamer, and never for the startup snapshot. */
export function shouldNotify(i: NotifyDecisionInput): boolean {
  return i.isLive && !i.wasLive && !i.initial && i.enabled
}

/** Badge text: live count, hidden when disabled or zero. */
export function liveBadgeText(count: number, show: boolean): string {
  return show && count > 0 ? String(count) : ''
}
