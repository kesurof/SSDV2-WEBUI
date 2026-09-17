import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { SetupPage } from '@/features/setup/SetupPage'

const HEALTH = {
  status: 'ok',
  docker: true,
  ssdv2: true,
  ssdv2ctl: true,
  database: true,
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function renderSetup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/setup']}>
        <Routes>
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/login" element={<div>page de connexion</div>} />
          <Route path="/dashboard" element={<div>tableau de bord</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function fillAccountStep(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Jeton d’installation'), 'jeton-installation')
  await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse-tres-long')
  await user.type(screen.getByLabelText('Confirmation du mot de passe'), 'motdepasse-tres-long')
}

describe('SetupPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('redirects to login when setup is already completed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ required: false, token_required: true, instance_name: 'SSDV2 WebUI' }),
      ),
    )

    renderSetup()

    await waitFor(() => expect(screen.getByText('page de connexion')).toBeInTheDocument())
  })

  it('blocks the account step while passwords differ', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ required: true, token_required: true, instance_name: 'x' })),
    )

    renderSetup()
    await waitFor(() => expect(screen.getByLabelText('Jeton d’installation')).toBeInTheDocument())

    await user.type(screen.getByLabelText('Jeton d’installation'), 'jeton-installation')
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse-tres-long')
    await user.type(screen.getByLabelText('Confirmation du mot de passe'), 'different-mot-de-passe')

    expect(screen.getByText('Les mots de passe ne correspondent pas.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Suivant' })).toBeDisabled()
  })

  it('runs the full wizard and submits the setup', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/v1/setup/status') {
        return jsonResponse({ required: true, token_required: true, instance_name: 'SSDV2 WebUI' })
      }
      if (url === '/api/v1/health') {
        return jsonResponse(HEALTH)
      }
      if (url === '/api/v1/setup' && init?.method === 'POST') {
        return jsonResponse({ username: 'admin', internal_auth: true }, 201)
      }
      return jsonResponse({})
    })
    vi.stubGlobal('fetch', fetchMock)

    renderSetup()
    await waitFor(() => expect(screen.getByLabelText('Jeton d’installation')).toBeInTheDocument())

    await fillAccountStep(user)
    await user.click(screen.getByRole('button', { name: 'Suivant' }))

    expect(screen.getByText('Authentification interne')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Suivant' }))

    await user.clear(screen.getByLabelText('Nom de l’instance'))
    await user.type(screen.getByLabelText('Nom de l’instance'), 'Prod SSDV2')
    await user.click(screen.getByRole('button', { name: 'Suivant' }))

    expect(screen.getByText('Environnement détecté')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Terminer l’installation' }))

    await waitFor(() => expect(screen.getByText('tableau de bord')).toBeInTheDocument())

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/setup',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          token: 'jeton-installation',
          username: 'admin',
          password: 'motdepasse-tres-long',
          internal_auth: true,
          instance_name: 'Prod SSDV2',
          notify_job_success: true,
        }),
      }),
    )
  })
})
