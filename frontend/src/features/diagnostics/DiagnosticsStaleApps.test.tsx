import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { DiagnosticsStaleApps } from '@/features/diagnostics/DiagnosticsStaleApps'

function renderStale(apps: string[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DiagnosticsStaleApps apps={apps} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function jobResponse() {
  return new Response(
    JSON.stringify({
      id: 12,
      type: 'diagnostics_purge_apps',
      target: 'diagnostics',
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

describe('DiagnosticsStaleApps', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists stale apps and requires typing SUPPRIMER', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async () => jobResponse())
    vi.stubGlobal('fetch', fetchMock)

    renderStale(['hermes', 'webtop'])

    expect(screen.getByRole('checkbox', { name: 'hermes' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'webtop' })).toBeChecked()

    await user.click(screen.getByRole('button', { name: /Nettoyer la sélection/ }))

    const confirm = screen.getByRole('button', { name: 'Confirmer' })
    expect(confirm).toBeDisabled()

    await user.type(screen.getByLabelText('Tapez « SUPPRIMER » pour confirmer'), 'SUPPRIMER')
    await user.click(confirm)

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/diagnostics/purge-apps',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ apps: ['hermes', 'webtop'], delete_data: false }),
      }),
    )
  })

  it('shows an empty message when nothing is stale', () => {
    renderStale([])
    expect(screen.getByText('Aucune application obsolète détectée.')).toBeInTheDocument()
  })
})
