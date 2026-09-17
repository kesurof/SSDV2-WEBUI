import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { DiagnosticsActions } from '@/features/diagnostics/DiagnosticsActions'

function renderActions() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DiagnosticsActions />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function jobResponse() {
  return new Response(
    JSON.stringify({
      id: 9,
      type: 'diagnostics_rebuild_registries',
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

describe('DiagnosticsActions', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts the registry rebuild after a simple confirmation', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async () => jobResponse())
    vi.stubGlobal('fetch', fetchMock)

    renderActions()
    await user.click(screen.getByRole('button', { name: 'Régénérer les registres' }))
    await user.click(screen.getByRole('button', { name: 'Confirmer' }))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/diagnostics/rebuild-registries',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('requires typing SUPPRIMER for destructive cleanups', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async () => jobResponse())
    vi.stubGlobal('fetch', fetchMock)

    renderActions()
    await user.click(screen.getByRole('button', { name: 'Supprimer les volumes orphelins' }))

    const confirmButton = screen.getByRole('button', { name: 'Confirmer' })
    expect(confirmButton).toBeDisabled()

    await user.type(screen.getByLabelText(/Tapez « SUPPRIMER » pour confirmer/), 'SUPPRIMER')
    expect(confirmButton).toBeEnabled()
    await user.click(confirmButton)

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/diagnostics/cleanup-dangling-volumes',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
