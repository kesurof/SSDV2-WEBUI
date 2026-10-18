import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { BackupsView } from '@/features/backups/BackupsView'
import type { Backup } from '@/api/types'

const BACKUPS: Backup[] = [
  {
    app: 'sonarr',
    file: 'sonarr-20260917-1200.tar.gz',
    size: 1024 * 1024 * 12,
    created_at: '2026-09-17T12:00:00',
  },
  {
    app: 'radarr',
    file: 'radarr-20260916-0900.tar.gz',
    size: 2048,
    created_at: '2026-09-16T09:00:00',
  },
]

describe('BackupsView', () => {
  it('renders backups with size', () => {
    render(<MemoryRouter><BackupsView backups={BACKUPS} /></MemoryRouter>)

    const desktop = within(screen.getByRole('table'))
    expect(desktop.getByRole('link', { name: 'sonarr' })).toHaveAttribute('href', '/apps/sonarr')
    expect(within(screen.getByRole('list', { name: 'Sauvegardes (vue mobile)' })).getByRole('link', { name: 'sonarr' })).toBeInTheDocument()
    expect(desktop.getByText('sonarr-20260917-1200.tar.gz')).toBeInTheDocument()
    expect(desktop.getByText('12.0 Mo')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Historique des sauvegardes' })).toBeInTheDocument()
    expect(desktop.getByText('2 Ko')).toBeInTheDocument()
  })

  it('renders an empty message', () => {
    render(<MemoryRouter><BackupsView backups={[]} /></MemoryRouter>)

    expect(screen.getByText('Aucune sauvegarde.')).toBeInTheDocument()
  })
})
