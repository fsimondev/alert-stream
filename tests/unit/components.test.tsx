import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddForm, StreamerItem } from '../../src/ui/components'
import type { Streamer } from '../../src/lib/types'

const sendMock = () => vi.mocked((globalThis as unknown as { chrome: { runtime: { sendMessage: ReturnType<typeof vi.fn> } } }).chrome.runtime.sendMessage)

const streamer: Streamer = {
  id: 'a',
  platform: 'twitch',
  login: 'xqc',
  displayName: 'xQc',
  enabled: true,
  soundEnabled: true,
  addedAt: 0,
}

describe('<AddForm />', () => {
  it('sends ADD_STREAMER with the typed input and selected platform', async () => {
    const user = userEvent.setup()
    render(<AddForm />)
    await user.type(screen.getByTestId('add-input'), 'xqc')
    await user.click(screen.getByTestId('add-submit'))
    await waitFor(() =>
      expect(sendMock()).toHaveBeenCalledWith({ type: 'ADD_STREAMER', input: 'xqc', hint: 'twitch' }),
    )
  })

  it('switches platform to Kick', async () => {
    const user = userEvent.setup()
    render(<AddForm />)
    await user.click(screen.getByTestId('platform-kick'))
    await user.type(screen.getByTestId('add-input'), 'adin')
    await user.click(screen.getByTestId('add-submit'))
    await waitFor(() =>
      expect(sendMock()).toHaveBeenCalledWith({ type: 'ADD_STREAMER', input: 'adin', hint: 'kick' }),
    )
  })

  it('shows an error returned by the background', async () => {
    sendMock().mockResolvedValueOnce({ ok: false, error: 'Déjà ajouté.' })
    const user = userEvent.setup()
    render(<AddForm />)
    await user.type(screen.getByTestId('add-input'), 'xqc')
    await user.click(screen.getByTestId('add-submit'))
    expect(await screen.findByTestId('add-error')).toHaveTextContent('Déjà ajouté.')
  })
})

describe('<StreamerItem />', () => {
  it('renders the LIVE state', () => {
    render(
      <StreamerItem
        streamer={streamer}
        rt={{ isLive: true, status: 'watching', lastChangedAt: Date.now(), title: 'GTA' }}
      />,
    )
    const item = screen.getByTestId('streamer-item')
    expect(item).toHaveAttribute('data-live', 'true')
    expect(within(item).getByText('LIVE')).toBeInTheDocument()
    expect(within(item).getByText('GTA')).toBeInTheDocument()
  })

  it('renders the offline state', () => {
    render(<StreamerItem streamer={streamer} rt={{ isLive: false, status: 'watching', lastChangedAt: 0 }} />)
    expect(screen.getByTestId('streamer-item')).toHaveAttribute('data-live', 'false')
  })

  it('removes via message on trash click', async () => {
    const user = userEvent.setup()
    render(<StreamerItem streamer={streamer} rt={{ isLive: false, status: 'idle', lastChangedAt: 0 }} />)
    await user.click(screen.getByTestId('streamer-remove'))
    expect(sendMock()).toHaveBeenCalledWith({ type: 'REMOVE_STREAMER', id: 'a' })
  })

  it('toggles per-streamer notifications', async () => {
    const user = userEvent.setup()
    render(<StreamerItem streamer={streamer} rt={{ isLive: false, status: 'idle', lastChangedAt: 0 }} />)
    await user.click(screen.getByTestId('streamer-enabled'))
    expect(sendMock()).toHaveBeenCalledWith({ type: 'SET_STREAMER_ENABLED', id: 'a', enabled: false })
  })
})
