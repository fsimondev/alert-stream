import { describe, expect, it } from 'vitest'
import { channelUrl, parseStreamInput } from '../../src/lib/parse-input'

describe('parseStreamInput', () => {
  it('parses full Twitch URLs', () => {
    expect(parseStreamInput('https://www.twitch.tv/xqc')).toEqual({ platform: 'twitch', login: 'xqc' })
    expect(parseStreamInput('http://twitch.tv/Pokimane')).toEqual({ platform: 'twitch', login: 'pokimane' })
  })

  it('parses host-less URLs', () => {
    expect(parseStreamInput('twitch.tv/XQC')).toEqual({ platform: 'twitch', login: 'xqc' })
    expect(parseStreamInput('kick.com/xyz')).toEqual({ platform: 'kick', login: 'xyz' })
  })

  it('parses Kick URLs with extra path segments', () => {
    expect(parseStreamInput('https://kick.com/Trainwreckstv/videos')).toEqual({
      platform: 'kick',
      login: 'trainwreckstv',
    })
  })

  it('parses bare handles only with a platform hint', () => {
    expect(parseStreamInput('Ninja', 'twitch')).toEqual({ platform: 'twitch', login: 'ninja' })
    expect(parseStreamInput('@adin', 'kick')).toEqual({ platform: 'kick', login: 'adin' })
    expect(parseStreamInput('ninja')).toBeNull()
  })

  it('rejects unsupported hosts', () => {
    expect(parseStreamInput('https://youtube.com/xqc')).toBeNull()
    expect(parseStreamInput('https://example.com/foo')).toBeNull()
  })

  it('rejects Twitch reserved routes', () => {
    expect(parseStreamInput('https://twitch.tv/videos')).toBeNull()
    expect(parseStreamInput('twitch.tv/directory')).toBeNull()
  })

  it('rejects empty / malformed input', () => {
    expect(parseStreamInput('   ')).toBeNull()
    expect(parseStreamInput('https://twitch.tv/')).toBeNull()
    expect(parseStreamInput('a', 'twitch')).toBeNull() // too short
    expect(parseStreamInput('bad name!', 'twitch')).toBeNull()
  })
})

describe('channelUrl', () => {
  it('builds platform URLs', () => {
    expect(channelUrl('twitch', 'xqc')).toBe('https://www.twitch.tv/xqc')
    expect(channelUrl('kick', 'xqc')).toBe('https://kick.com/xqc')
  })
})
