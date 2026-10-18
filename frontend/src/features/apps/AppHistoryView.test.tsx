import { render, screen, within } from '@testing-library/react'
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
    expect(within(screen.getByRole('table')).getByText('Redémarrage')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('dozzle-20260917-0200.tar.gz')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('admin')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('système')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Historique (vue mobile)' })).getByRole('link', { name: /Consulter le job #12/ })).toHaveAttribute('href', '/jobs/12')
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
