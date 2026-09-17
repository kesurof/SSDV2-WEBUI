import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SecuritySettings } from '@/features/settings/SecuritySettings'

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function renderSecurity() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <SecuritySettings />
    </QueryClientProvider>,
  )
}

describe('SecuritySettings', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('disables internal auth after typed confirmation', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        return jsonResponse({ internal_auth: false })
      }
      return jsonResponse({ internal_auth: true })
    })
    vi.stubGlobal('fetch', fetchMock)

    renderSecurity()
    await waitFor(() => expect(screen.getByText('Activée')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Désactiver' }))
    const confirmButton = screen.getByRole('button', { name: 'Confirmer' })
    expect(confirmButton).toBeDisabled()

    await user.type(screen.getByLabelText(/Tapez « DESACTIVER »/), 'DESACTIVER')
    expect(confirmButton).toBeEnabled()
    await user.click(confirmButton)

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/security',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ internal_auth: false }),
      }),
    )
  })

  it('re-enables internal auth with a simple confirmation', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        return jsonResponse({ internal_auth: true })
      }
      return jsonResponse({ internal_auth: false })
    })
    vi.stubGlobal('fetch', fetchMock)

    renderSecurity()
    await waitFor(() => expect(screen.getByText('Désactivée (auth externe)')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Activer' }))
    await user.click(screen.getByRole('button', { name: 'Confirmer' }))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/security',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ internal_auth: true }),
      }),
    )
  })
})
