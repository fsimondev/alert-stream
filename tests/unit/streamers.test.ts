import { describe, expect, it } from 'vitest'
import {
  findDuplicate,
  makeStreamer,
  removeStreamer,
  sortStreamers,
  updateStreamer,
} from '../../src/lib/streamers'
import type { Streamer } from '../../src/lib/types'

const base = (over: Partial<Streamer> = {}): Streamer => ({
  id: 'id1',
  platform: 'twitch',
  login: 'xqc',
  displayName: 'xqc',
  enabled: true,
  soundEnabled: true,
  addedAt: 0,
  ...over,
})

describe('streamers helpers', () => {
  it('makeStreamer builds defaults', () => {
    const s = makeStreamer({ platform: 'kick', login: 'adin' }, 'abc', 123)
    expect(s).toMatchObject({
      id: 'abc',
      platform: 'kick',
      login: 'adin',
      displayName: 'adin',
      enabled: true,
      soundEnabled: true,
      addedAt: 123,
    })
  })

  it('findDuplicate matches platform + login', () => {
    const list = [base()]
    expect(findDuplicate(list, { platform: 'twitch', login: 'xqc' })).toBeTruthy()
    expect(findDuplicate(list, { platform: 'kick', login: 'xqc' })).toBeUndefined()
    expect(findDuplicate(list, { platform: 'twitch', login: 'other' })).toBeUndefined()
  })

  it('removeStreamer removes by id', () => {
    const list = [base({ id: 'a' }), base({ id: 'b' })]
    expect(removeStreamer(list, 'a').map((s) => s.id)).toEqual(['b'])
  })

  it('updateStreamer patches one item immutably', () => {
    const list = [base({ id: 'a', enabled: true }), base({ id: 'b' })]
    const next = updateStreamer(list, 'a', { enabled: false })
    expect(next[0].enabled).toBe(false)
    expect(list[0].enabled).toBe(true) // original untouched
    expect(next[1]).toBe(list[1])
  })

  it('sortStreamers sorts by display name', () => {
    const list = [base({ displayName: 'Zoe' }), base({ displayName: 'amy' }), base({ displayName: 'Bob' })]
    expect(sortStreamers(list).map((s) => s.displayName)).toEqual(['amy', 'Bob', 'Zoe'])
  })
})
