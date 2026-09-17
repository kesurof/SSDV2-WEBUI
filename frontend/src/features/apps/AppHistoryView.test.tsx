import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { AppHistoryView } from '@/features/apps/AppHistoryView'
import type { AppHistoryEvent } from '@/api/types'

const EVENTS: AppHistoryEvent[] = [
  {
    kind: 'job',
    at: '2026-09-17T10:01:00',
    actor: 'admin',
    label: 'app_restart',
    result: 'failed',
    job_id: 12,
  },
  {
    kind: 'backup',
    at: '2026-09-17T02:00:00',
    actor: null,
    label: 'dozzle-20260917-0200.tar.gz',
    result: 'success',
    job_id: null,
  },
]

describe('AppHistoryView', () => {
  it('renders the aggregated timeline', () => {
    render(
      <MemoryRouter>
        <AppHistoryView app="dozzle" events={EVENTS} filter="all" onFilterChange={() => {}} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Historique — dozzle' })).toBeInTheDocument()
    expect(screen.getByText('Redémarrage')).toBeInTheDocument()
    expect(screen.getByText('dozzle-20260917-0200.tar.gz')).toBeInTheDocument()
    expect(screen.getByText('admin')).toBeInTheDocument()
    expect(screen.getByText('système')).toBeInTheDocument()
  })

  it('renders the empty state', () => {
    render(
      <MemoryRouter>
        <AppHistoryView app="dozzle" events={[]} filter="all" onFilterChange={() => {}} />
      </MemoryRouter>,
    )

    expect(screen.getByText('Aucun événement pour cette application.')).toBeInTheDocument()
  })
})
