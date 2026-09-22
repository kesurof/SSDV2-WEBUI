import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AuthAppsView } from '@/features/auth/AuthAppsView'
import type { AppState } from '@/api/types'

function makeApp(name: string, domain: string | null = null): AppState {
  return {
    name,
    description: '',
    available: true,
    installed: true,
    runtime_status: 'running',
    healthy: true,
    url: domain ? `https://${domain}` : null,
    domain,
    image: null,
    containers: 1,
    warnings: [],
  }
}

const APPS = [makeApp('sonarr', 'sonarr.example.com'), makeApp('radarr')]

describe('AuthAppsView', () => {
  it('applies the selected auth after confirmation', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    const onToggle = vi.fn()

    render(
      <AuthAppsView
        apps={APPS}
        authByApp={{ sonarr: 'authelia', radarr: null }}
        selected={['sonarr', 'radarr']}
        auth="oauth2-proxy"
        busy={false}
        onToggle={onToggle}
        onToggleAll={vi.fn()}
        onAuthChange={vi.fn()}
        onApply={onApply}
      />,
    )

    expect(screen.getByRole('cell', { name: 'authelia' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'sonarr.example.com' })).toHaveAttribute(
      'href',
      'https://sonarr.example.com',
    )
    await user.click(screen.getByRole('checkbox', { name: 'sonarr' }))
    expect(onToggle).toHaveBeenCalledWith('sonarr')

    await user.click(screen.getByRole('button', { name: /Appliquer/ }))
    expect(
      screen.getByText(
        'Changer l’authentification de 2 application(s) vers « oauth2-proxy » ? Les applications sélectionnées seront recréées pour appliquer le changement.',
      ),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirmer' }))
    expect(onApply).toHaveBeenCalled()
  })

  it('disables apply without selection', () => {
    render(
      <AuthAppsView
        apps={APPS}
        authByApp={{}}
        selected={[]}
        auth="aucune"
        busy={false}
        onToggle={vi.fn()}
        onToggleAll={vi.fn()}
        onAuthChange={vi.fn()}
        onApply={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /Appliquer/ })).toBeDisabled()
  })
})
