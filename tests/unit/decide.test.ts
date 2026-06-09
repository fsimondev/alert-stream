import { describe, expect, it } from 'vitest'
import { liveBadgeText, shouldNotify } from '../../src/background/decide'

describe('shouldNotify', () => {
  it('fires on a genuine off -> on transition for an enabled streamer', () => {
    expect(shouldNotify({ wasLive: false, isLive: true, enabled: true })).toBe(true)
  })

  it('does not fire when already live (no transition)', () => {
    expect(shouldNotify({ wasLive: true, isLive: true, enabled: true })).toBe(false)
  })

  it('does not fire on going offline', () => {
    expect(shouldNotify({ wasLive: true, isLive: false, enabled: true })).toBe(false)
  })

  it('does not fire on the startup snapshot', () => {
    expect(shouldNotify({ wasLive: false, isLive: true, enabled: true, initial: true })).toBe(false)
  })

  it('does not fire when notifications are disabled', () => {
    expect(shouldNotify({ wasLive: false, isLive: true, enabled: false })).toBe(false)
  })
})

describe('liveBadgeText', () => {
  it('shows the count when enabled and > 0', () => {
    expect(liveBadgeText(3, true)).toBe('3')
  })
  it('hides at zero or when disabled', () => {
    expect(liveBadgeText(0, true)).toBe('')
    expect(liveBadgeText(5, false)).toBe('')
  })
})
