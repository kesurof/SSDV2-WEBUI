import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { JobDetailView } from '@/features/jobs/JobDetailView'
import type { Job } from '@/api/types'

const JOB: Job = {
  id: 3,
  type: 'app_restart',
  target: 'sonarr',
  status: 'failed',
  created_at: '2026-09-17T10:00:00',
  started_at: '2026-09-17T10:00:01',
  finished_at: '2026-09-17T10:00:05',
  exit_code: 1,
  message: 'ssdv2ctl a retourné le code 1',
}

describe('JobDetailView', () => {
  it('renders job, failure and events', () => {
    render(
      <MemoryRouter>
        <JobDetailView job={JOB} lines={['ligne 1', 'ligne 2']} done />
      </MemoryRouter>,
    )

    expect(screen.getByText('#3 — Redémarrage sonarr')).toBeInTheDocument()
    expect(screen.getByText('ssdv2ctl a retourné le code 1')).toBeInTheDocument()
    expect(screen.getByText(/ligne 1/)).toBeInTheDocument()
  })
})
