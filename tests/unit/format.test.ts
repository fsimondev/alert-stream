import { describe, expect, it } from 'vitest'
import { initialOf, timeAgo } from '../../src/ui/format'

describe('timeAgo', () => {
  const now = 1_000_000_000_000
  it('handles seconds, minutes, hours, days', () => {
    expect(timeAgo(now - 10_000, now)).toBe("à l'instant")
    expect(timeAgo(now - 5 * 60_000, now)).toBe('il y a 5 min')
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe('il y a 3 h')
    expect(timeAgo(now - 2 * 86_400_000, now)).toBe('il y a 2 j')
  })
  it('returns empty for falsy timestamps', () => {
    expect(timeAgo(0, now)).toBe('')
  })
})

describe('initialOf', () => {
  it('uppercases the first character', () => {
    expect(initialOf('xqc')).toBe('X')
    expect(initialOf('  adin')).toBe('A')
    expect(initialOf('')).toBe('?')
  })
})
