import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { UpdateScheduleCard } from '@/features/updates/UpdateScheduleCard'

const SCHEDULE = {
  schema_version: 1,
  enabled: false,
  start: '03:00',
  end: '05:00',
  timezone: 'Europe/Paris',
  last_run_at: null,
  next_run_at: null,
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function renderCard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <UpdateScheduleCard />
    </QueryClientProvider>,
  )
}

describe('UpdateScheduleCard', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('affiche le réglage et l’enregistre', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        return jsonResponse({ ...SCHEDULE, enabled: true })
      }
      return jsonResponse(SCHEDULE)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderCard()

    const toggle = await screen.findByRole('checkbox', {
      name: 'Activer la mise à jour automatique',
    })
    expect(toggle).not.toBeChecked()
    expect(screen.getByText(/Europe\/Paris/)).toBeInTheDocument()

    await user.click(toggle)
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/updates/schedule',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ enabled: true, start: '03:00', end: '05:00' }),
      }),
    )
  })

  it('refuse une tranche dont la fin précède le début', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(SCHEDULE)),
    )

    renderCard()

    await user.click(await screen.findByRole('checkbox'))
    fireEvent.change(screen.getByLabelText('Début'), { target: { value: '06:00' } })

    expect(
      screen.getByText("L'heure de fin doit être postérieure à l'heure de début."),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  })
})
