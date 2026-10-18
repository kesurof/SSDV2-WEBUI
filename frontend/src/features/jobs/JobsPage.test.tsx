import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { JobsPage } from '@/features/jobs/JobsPage'
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

vi.mock('@/features/jobs/useJobs', () => ({
  useJobs: () => ({ data: [JOB], isPending: false, isError: false }),
  useAppAction: () => ({ mutate: vi.fn(), isPending: false }),
  useSubmitJobInput: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/features/jobs/useJobEvents', () => ({
  useJobEvents: () => ({
    lines: ['long-job-log-line-'.repeat(120)],
    done: true,
    prompt: null,
    dismissPrompt: vi.fn(),
  }),
}))

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/jobs/:id" element={<JobsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('JobsPage responsive navigation', () => {
  it('uses an exclusive mobile list and detail and provides a back link', async () => {
    const user = userEvent.setup()
    renderAt('/jobs')

    expect(screen.getByTestId('jobs-list-panel')).not.toHaveClass('hidden')
    expect(screen.getByTestId('jobs-detail-panel')).toHaveClass('hidden', 'lg:block')
    await user.click(screen.getByRole('link', { name: /#3/ }))

    expect(screen.getByTestId('jobs-list-panel')).toHaveClass('hidden', 'lg:block')
    expect(screen.getByTestId('jobs-detail-panel')).not.toHaveClass('hidden')
    expect(screen.getByRole('link', { name: 'Retour aux jobs' })).toHaveAttribute('href', '/jobs')

    await user.click(screen.getByRole('link', { name: 'Retour aux jobs' }))
    expect(screen.getByTestId('jobs-list-panel')).not.toHaveClass('hidden')
    expect(screen.getByTestId('jobs-detail-panel')).toHaveClass('hidden', 'lg:block')
  })

  it('opens the detail directly and constrains its console width', () => {
    renderAt('/jobs/3')
    expect(screen.getByRole('link', { name: 'Retour aux jobs' })).toBeInTheDocument()
    expect(screen.getByTestId('job-log-console')).toHaveClass('overflow-x-auto', 'max-w-full')
    expect(screen.getByTestId('jobs-detail-panel')).toHaveClass('min-w-0', 'max-w-full')
  })
})
