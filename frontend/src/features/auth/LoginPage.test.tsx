import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { LoginPage } from '@/features/auth/LoginPage'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function renderLogin() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<div>tableau de bord</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function submitLogin(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Identifiant'), 'admin')
  await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse-tres-long')
  await user.click(screen.getByRole('button', { name: 'Se connecter' }))
}

describe('LoginPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows an explicit message when the server fails', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/v1/setup/status') {
          return jsonResponse({ required: false, token_required: true, instance_name: 'x' })
        }
        if (url === '/api/v1/auth/me') {
          return jsonResponse({ detail: 'Non authentifié' }, 401)
        }
        return jsonResponse({ detail: 'Bad gateway' }, 502)
      }),
    )

    renderLogin()
    await submitLogin(user)

    expect(await screen.findByText(/Erreur de connexion \(502\)/)).toBeInTheDocument()
    expect(screen.queryByText('Identifiants invalides.')).not.toBeInTheDocument()
  })

  it('shows invalid credentials on 401', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/v1/setup/status') {
          return jsonResponse({ required: false, token_required: true, instance_name: 'x' })
        }
        return jsonResponse({ detail: 'Identifiants invalides' }, 401)
      }),
    )

    renderLogin()
    await submitLogin(user)

    expect(await screen.findByText('Identifiants invalides.')).toBeInTheDocument()
  })
})
