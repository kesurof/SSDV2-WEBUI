import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

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
      <MemoryRouter>
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
      />
      </MemoryRouter>,
    )

    expect(screen.getByRole('cell', { name: 'authelia' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Modification groupée' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Applications et protections' })).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByRole('link', { name: 'sonarr.example.com' })).toHaveAttribute(
      'href',
      'https://sonarr.example.com',
    )
    expect(within(screen.getByRole('list', { name: 'Authentification des applications (vue mobile)' })).getByRole('link', { name: 'sonarr' })).toHaveAttribute('href', '/apps/sonarr')
    await user.click(screen.getByRole('checkbox', { name: 'sonarr' }))
    expect(onToggle).toHaveBeenCalledWith('sonarr')

    await user.click(screen.getByRole('button', { name: /Appliquer/ }))
    expect(
      screen.getByText(
        'Changer l’authentification de 2 application(s) vers « oauth2-proxy » ? Les conteneurs des applications modifiées seront recréés (labels Traefik uniquement) pour appliquer le changement.',
      ),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirmer' }))
    expect(onApply).toHaveBeenCalled()
  })

  it('disables apply without selection', () => {
    render(
      <MemoryRouter>
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
      />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: /Appliquer/ })).toBeDisabled()
  })
})
