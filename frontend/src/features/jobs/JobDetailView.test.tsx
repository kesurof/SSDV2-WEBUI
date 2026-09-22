import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { JobDetailView } from '@/features/jobs/JobDetailView'
import type { JobPrompt } from '@/features/jobs/useJobEvents'
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

  it('renders a secret prompt and submits the value', async () => {
    const user = userEvent.setup()
    const onInput = vi.fn()
    const prompt: JobPrompt = {
      id: '3:1',
      spec: 'plex.password',
      label: 'Mot de passe Plex',
      kind: 'secret',
      secret: true,
      default: '',
      options: [],
    }

    render(
      <MemoryRouter>
        <JobDetailView
          job={{ ...JOB, status: 'running', finished_at: null }}
          lines={[]}
          done={false}
          prompt={prompt}
          onInput={onInput}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('Action requise')).toBeInTheDocument()
    expect(screen.getAllByText('Mot de passe Plex').length).toBeGreaterThan(0)
    const input = screen.getByLabelText('Mot de passe Plex')
    expect(input).toHaveAttribute('type', 'password')
    await user.type(input, 'secret-value')
    await user.click(screen.getByRole('button', { name: 'Envoyer' }))
    expect(onInput).toHaveBeenCalledWith('secret-value')
  })

  it('copies the job logs', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    render(
      <MemoryRouter>
        <JobDetailView job={JOB} lines={['ligne 1', 'ligne 2']} done />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Copier' }))
    expect(writeText).toHaveBeenCalledWith('ligne 1\nligne 2')
  })

  it('renders a choice prompt with option buttons', async () => {
    const user = userEvent.setup()
    const onInput = vi.fn()
    const prompt: JobPrompt = {
      id: '3:2',
      spec: 'app.auth',
      label: 'Authentification',
      kind: 'choice',
      secret: false,
      default: '5',
      options: [
        { value: '4', label: 'aucune' },
        { value: '5', label: 'oauth2-proxy' },
      ],
    }

    render(
      <MemoryRouter>
        <JobDetailView
          job={{ ...JOB, status: 'running', finished_at: null }}
          lines={[]}
          done={false}
          prompt={prompt}
          onInput={onInput}
        />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'oauth2-proxy' }))
    expect(onInput).toHaveBeenCalledWith('5')
  })
})
