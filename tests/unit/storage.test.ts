import { describe, expect, it, vi } from 'vitest'
import {
  getRuntime,
  getSettings,
  getStreamers,
  onKeyChanged,
  patchRuntime,
  pruneRuntime,
  setSettings,
  setStreamers,
} from '../../src/lib/storage'
import { DEFAULT_SETTINGS, type Streamer } from '../../src/lib/types'

const streamer: Streamer = {
  id: 'a',
  platform: 'twitch',
  login: 'xqc',
  displayName: 'xqc',
  enabled: true,
  soundEnabled: true,
  addedAt: 0,
}

describe('storage', () => {
  it('round-trips streamers', async () => {
    expect(await getStreamers()).toEqual([])
    await setStreamers([streamer])
    expect(await getStreamers()).toEqual([streamer])
  })

  it('returns default settings when empty and merges partial', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS)
    await setSettings({ ...DEFAULT_SETTINGS, soundEnabled: false, twitchClientId: 'cid' })
    const s = await getSettings()
    expect(s.soundEnabled).toBe(false)
    expect(s.twitchClientId).toBe('cid')
    expect(s.openOnClick).toBe(DEFAULT_SETTINGS.openOnClick)
  })

  it('patchRuntime creates then merges', async () => {
    await patchRuntime('a', { isLive: true, status: 'watching', lastChangedAt: 1 })
    let rt = await getRuntime()
    expect(rt.a).toMatchObject({ isLive: true, status: 'watching' })
    await patchRuntime('a', { title: 'hello' })
    rt = await getRuntime()
    expect(rt.a).toMatchObject({ isLive: true, title: 'hello' })
  })

  it('serializes concurrent patches without losing writes', async () => {
    await Promise.all([
      patchRuntime('a', { isLive: true }),
      patchRuntime('b', { isLive: false, status: 'idle' }),
      patchRuntime('a', { title: 't' }),
    ])
    const rt = await getRuntime()
    expect(rt.a).toMatchObject({ isLive: true, title: 't' })
    expect(rt.b).toMatchObject({ status: 'idle' })
  })

  it('pruneRuntime drops unknown ids', async () => {
    await patchRuntime('a', { isLive: true })
    await patchRuntime('ghost', { isLive: true })
    await pruneRuntime(new Set(['a']))
    const rt = await getRuntime()
    expect(rt.a).toBeTruthy()
    expect(rt.ghost).toBeUndefined()
  })

  it('onKeyChanged fires for the watched key/area only', async () => {
    const cb = vi.fn()
    const unsub = onKeyChanged('streamers', 'sync', cb)
    await setStreamers([streamer])
    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith([streamer])
    // different area should not fire this listener
    await patchRuntime('a', { isLive: true })
    expect(cb).toHaveBeenCalledTimes(1)
    unsub()
    await setStreamers([])
    expect(cb).toHaveBeenCalledTimes(1)
  })
})
