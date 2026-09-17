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

const JOB_RESPONSE = {
  id: 7,
  type: 'app_restart',
  target: 'sonarr',
  status: 'queued',
  created_at: '2026-09-17T10:00:00',
  started_at: null,
  finished_at: null,
  exit_code: null,
  message: null,
}

describe('AppActions', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('disables actions according to the application state', () => {
    renderActions(makeApp({ runtime_status: 'stopped' }))

    expect(screen.getByRole('button', { name: 'Démarrer' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Arrêter' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Redémarrer' })).toBeEnabled()
  })

  it('disables all actions for a non-installed application', () => {
    renderActions(makeApp({ installed: false, runtime_status: 'not_installed' }))

    expect(screen.getByRole('button', { name: 'Démarrer' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Redémarrer' })).toBeDisabled()
  })

  it('confirms before restarting and posts the action', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(JOB_RESPONSE), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    renderActions(makeApp())
    await user.click(screen.getByRole('button', { name: 'Redémarrer' }))

    expect(screen.getByText(/Voulez-vous vraiment effectuer « redémarrer » sur sonarr/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Confirmer' }))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/apps/sonarr/restart',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
