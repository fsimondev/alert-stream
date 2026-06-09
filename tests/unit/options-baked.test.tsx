import { describe, expect, it, vi } from 'vitest'

// Simulate a baked-in Twitch Client ID (the "one-click" build).
vi.mock('../../src/lib/config', () => ({ DEFAULT_TWITCH_CLIENT_ID: 'baked-client-id' }))

import { render, screen } from '@testing-library/react'
import { Options } from '../../src/options/Options'

describe('Options — mode un-clic (Client ID en dur)', () => {
  it('montre un simple bouton « Se connecter avec Twitch » et masque le setup', async () => {
    render(<Options />)
    const connect = await screen.findByTestId('twitch-connect')
    expect(connect).toHaveTextContent('Se connecter avec Twitch')
    // Le bouton est actif sans rien coller (Client ID déjà fourni).
    expect(connect).toBeEnabled()
    // Les instructions de création d'app ne sont plus affichées.
    expect(screen.queryByText(/EventSub exige un/i)).toBeNull()
    // Le champ Client ID est relégué dans « Avancé ».
    expect(screen.getByText(/Avancé/i)).toBeInTheDocument()
  })
})
