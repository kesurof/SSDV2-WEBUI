import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { UpdatesView } from '@/features/updates/UpdatesView'
import type { Updates } from '@/api/types'

const UPDATES: Updates = {
  schema_version: 1,
  checked_at: '2026-09-17T10:00:00',
  available: 1,
  entries: [
    {
      app: 'dozzle',
      image: 'amir20/dozzle:latest',
      current_digest: 'aaaa11112222',
      available_digest: 'bbbb33334444',
      status: 'available',
    },
    {
      app: 'prowlarr',
      image: 'linuxserver/prowlarr:latest',
      current_digest: 'cccc55556666',
      available_digest: 'cccc55556666',
      status: 'up_to_date',
    },
  ],
}

function renderUpdates(updates: Updates) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <UpdatesView updates={updates} onRefresh={() => {}} />
    </QueryClientProvider>,
  )
}

describe('UpdatesView', () => {
  it('renders entries with statuses and update action', () => {
    renderUpdates(UPDATES)

    expect(screen.getByRole('heading', { name: 'Centre de mises à jour' })).toBeInTheDocument()
    expect(screen.getByText('dozzle')).toBeInTheDocument()
    expect(screen.getByText('prowlarr')).toBeInTheDocument()
    expect(screen.getByText('Mise à jour disponible')).toBeInTheDocument()
    expect(screen.getByText('À jour')).toBeInTheDocument()
    expect(screen.getByText('1 mise(s) à jour disponible(s)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Mettre à jour/ })).toBeInTheDocument()
  })

  it('renders unknown statuses', () => {
    renderUpdates({
      ...UPDATES,
      available: 0,
      entries: [
        {
          app: 'prive',
          image: 'registry.example.com/prive/app:latest',
          current_digest: null,
          available_digest: null,
          status: 'unknown',
        },
      ],
    })

    expect(screen.getByText('Inconnu')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Mettre à jour/ })).not.toBeInTheDocument()
  })
})
