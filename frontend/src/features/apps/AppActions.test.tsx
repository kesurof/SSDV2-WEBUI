import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { AppActions } from '@/features/apps/AppActions'
import type { AppDetail } from '@/api/types'

function makeApp(overrides: Partial<AppDetail> = {}): AppDetail {
  return {
    name: 'sonarr',
    description: 'Gestion Séries',
    available: true,
    installed: true,
    runtime_status: 'running',
    healthy: true,
    url: null,
    domain: null,
    image: null,
    containers: 1,
    warnings: [],
    container_list: [],
    ssddb: null,
    registries: { containers: [], volumes: [], dns: [] },
    ...overrides,
  }
}

function renderActions(app: AppDetail) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AppActions app={app} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function jobResponse() {
  return new Response(
    JSON.stringify({
      id: 7,
      type: 'app_restart',
      target: 'sonarr',
      status: 'queued',
      created_at: '2026-09-17T10:00:00',
      started_at: null,
      finished_at: null,
      exit_code: null,
      message: null,
    }),
    { status: 202, headers: { 'content-type': 'application/json' } },
  )
}

describe('AppActions', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the relevant power action according to the application state', () => {
    const { unmount } = renderActions(makeApp({ runtime_status: 'stopped' }))

    expect(screen.getByRole('button', { name: 'Démarrer' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Arrêter' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Redémarrer' })).toBeEnabled()
    unmount()

    renderActions(makeApp({ runtime_status: 'running' }))
    expect(screen.getByRole('button', { name: 'Arrêter' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Démarrer' })).not.toBeInTheDocument()
  })

  it("affiche le bouton Ouvrir uniquement avec une URL", () => {
    const { unmount } = renderActions(makeApp())
    expect(screen.queryByRole('link', { name: /Ouvrir/ })).not.toBeInTheDocument()
    unmount()

    renderActions(makeApp({ url: 'https://sonarr.exemple.tld' }))
    const link = screen.getByRole('link', { name: /Ouvrir/ })
    expect(link).toHaveAttribute('href', 'https://sonarr.exemple.tld')
  })

  it('offers only install for a non-installed application', () => {
    renderActions(makeApp({ installed: false, runtime_status: 'not_installed' }))

    expect(screen.getByRole('button', { name: 'Installer' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Redémarrer' })).not.toBeInTheDocument()
  })

  it('confirms before restarting and posts the action', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async () => jobResponse())
    vi.stubGlobal('fetch', fetchMock)

    renderActions(makeApp())
    await user.click(screen.getByRole('button', { name: 'Redémarrer' }))

    expect(
      screen.getByText(/Voulez-vous vraiment effectuer « redémarrer » sur sonarr/),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Confirmer' }))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/apps/sonarr/restart',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('installs with the chosen subdomain and auth', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async () => jobResponse())
    vi.stubGlobal('fetch', fetchMock)

    renderActions(makeApp({ installed: false, runtime_status: 'not_installed' }))
    await user.click(screen.getByRole('button', { name: 'Installer' }))

    expect(screen.getByLabelText('Sous-domaine')).toHaveValue('sonarr')
    await user.selectOptions(screen.getByLabelText('Authentification'), 'authelia')
    await user.click(screen.getByRole('button', { name: 'Confirmer' }))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/apps/sonarr/install',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ auth: 'authelia', subdomain: 'sonarr' }),
      }),
    )
  })

  it('requires typing the application name before deleting data', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async () => jobResponse())
    vi.stubGlobal('fetch', fetchMock)

    renderActions(makeApp())
    await user.click(screen.getByRole('button', { name: 'Plus d’actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Supprimer' }))

    await user.selectOptions(screen.getByRole('combobox'), 'delete')
    const confirmButton = screen.getByRole('button', { name: 'Confirmer' })
    expect(confirmButton).toBeDisabled()

    await user.type(screen.getByLabelText(/Tapez « sonarr » pour confirmer/), 'sonarr')
    expect(confirmButton).toBeEnabled()
    await user.click(confirmButton)

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/apps/sonarr/remove',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ delete_data: true }),
      }),
    )
  })

  it('launches a backup from the visible action', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async () => jobResponse())
    vi.stubGlobal('fetch', fetchMock)

    renderActions(makeApp())
    await user.click(screen.getByRole('button', { name: 'Sauvegarder' }))
    await user.click(screen.getByRole('button', { name: 'Confirmer' }))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/apps/sonarr/backup',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
