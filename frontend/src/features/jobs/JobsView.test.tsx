import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { JobsView } from '@/features/jobs/JobsView'
import type { Job } from '@/api/types'

const JOB: Job = {
  id: 3,
  type: 'app_restart',
  target: 'sonarr',
  status: 'success',
  created_at: '2026-09-17T10:00:00',
  started_at: '2026-09-17T10:00:01',
  finished_at: '2026-09-17T10:00:05',
  exit_code: 0,
  message: null,
}

describe('JobsView', () => {
  it('renders jobs', () => {
    render(
      <MemoryRouter>
        <JobsView jobs={[JOB]} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: /#3/ })).toHaveAttribute('href', '/jobs/3')
    expect(screen.getByText(/Redémarrage/)).toBeInTheDocument()
    expect(screen.getByText(/sonarr/)).toBeInTheDocument()
    expect(screen.getAllByText('Succès').length).toBeGreaterThan(0)
  })

  it('renders an empty message', () => {
    render(
      <MemoryRouter>
        <JobsView jobs={[]} />
      </MemoryRouter>,
    )

    expect(screen.getByText('Aucun job.')).toBeInTheDocument()
  })
})
