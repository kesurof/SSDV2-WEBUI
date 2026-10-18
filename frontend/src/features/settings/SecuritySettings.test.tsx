import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SecuritySettings } from '@/features/settings/SecuritySettings'

const INTERNAL = {
  mode: 'internal',
  mode_source: 'settings',
  internal_auth: true,
  external_logout_url: null,
  trusted_proxies_configured: false,
}

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

  it('enregistre le basculement vers le mode proxy', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        return jsonResponse({ ...INTERNAL, mode: 'proxy', internal_auth: false })
      }
      return jsonResponse({ ...INTERNAL, trusted_proxies_configured: true })
    })
    vi.stubGlobal('fetch', fetchMock)

    renderSecurity()
    await waitFor(() => expect(screen.getAllByRole('radio')).toHaveLength(2))

    const proxyRadio = screen.getAllByRole('radio')[1]
    expect(proxyRadio).toBeEnabled()
    await user.click(proxyRadio)

    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/security',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ mode: 'proxy' }),
      }),
    )
  })

  it('désactive le mode proxy sans proxy de confiance', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(INTERNAL)))

    renderSecurity()
    await waitFor(() => expect(screen.getAllByRole('radio')).toHaveLength(2))

    expect(screen.getAllByRole('radio')[1]).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  })

  it('verrouille le mode imposé par l’environnement', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ ...INTERNAL, mode_source: 'env', trusted_proxies_configured: true }),
      ),
    )

    renderSecurity()
    await waitFor(() => expect(screen.getAllByRole('radio')).toHaveLength(2))

    expect(screen.getAllByRole('radio')[0]).toBeDisabled()
    expect(screen.getAllByRole('radio')[1]).toBeDisabled()
    expect(screen.getByText(/imposé par WEBUI_AUTH_MODE/)).toBeInTheDocument()
  })

  it('changes the admin password', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return new Response(null, { status: 204 })
      }
      return jsonResponse(INTERNAL)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderSecurity()
    await waitFor(() => expect(screen.getByLabelText('Mot de passe actuel')).toBeInTheDocument())

    const submit = screen.getByRole('button', { name: 'Modifier le mot de passe' })
    expect(submit).toBeDisabled()

    await user.type(screen.getByLabelText('Mot de passe actuel'), 'test-password')
    await user.type(screen.getByLabelText('Nouveau mot de passe'), 'nouveau-mot-de-passe')
    await user.type(
      screen.getByLabelText('Confirmation du nouveau mot de passe'),
      'nouveau-mot-de-passe',
    )
    expect(submit).toBeEnabled()
    await user.click(submit)

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/password',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          current_password: 'test-password',
          new_password: 'nouveau-mot-de-passe',
        }),
      }),
    )
  })
})
