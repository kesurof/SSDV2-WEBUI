import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('paginates the job list', async () => {
    const user = userEvent.setup()
    const jobs: Job[] = Array.from({ length: 25 }, (_, index) => ({ ...JOB, id: index + 1 }))

    render(
      <MemoryRouter>
        <JobsView jobs={jobs} />
      </MemoryRouter>,
    )

    expect(screen.queryByText('#25')).not.toBeInTheDocument()
    expect(screen.getByText(/1–20 \/ 25/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Suivant' }))

    expect(screen.getByText('#25')).toBeInTheDocument()
    expect(screen.queryByText('#1')).not.toBeInTheDocument()
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
  })
})
