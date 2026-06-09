import { describe, expect, it } from 'vitest'
import { buildAuthUrl, parseTokenFromRedirect } from '../../src/lib/twitch/api'

describe('buildAuthUrl', () => {
  it('builds an implicit-grant authorize URL', () => {
    const url = new URL(buildAuthUrl('my-client', 'https://ext.chromiumapp.org/'))
    expect(url.origin + url.pathname).toBe('https://id.twitch.tv/oauth2/authorize')
    expect(url.searchParams.get('client_id')).toBe('my-client')
    expect(url.searchParams.get('redirect_uri')).toBe('https://ext.chromiumapp.org/')
    expect(url.searchParams.get('response_type')).toBe('token')
  })
})

describe('parseTokenFromRedirect', () => {
  it('extracts the access token from the fragment', () => {
    const redirect =
      'https://ext.chromiumapp.org/#access_token=abc123&scope=&token_type=bearer'
    expect(parseTokenFromRedirect(redirect)).toEqual({ accessToken: 'abc123', scopes: [] })
  })

  it('parses scopes when present', () => {
    const redirect = 'https://x/#access_token=t&scope=user%3Aread%3Aemail'
    const res = parseTokenFromRedirect(redirect)
    expect(res?.accessToken).toBe('t')
    expect(res?.scopes).toEqual(['user:read:email'])
  })

  it('returns null when there is no token', () => {
    expect(parseTokenFromRedirect('https://x/#error=access_denied')).toBeNull()
    expect(parseTokenFromRedirect('https://x/no-fragment')).toBeNull()
  })
})
