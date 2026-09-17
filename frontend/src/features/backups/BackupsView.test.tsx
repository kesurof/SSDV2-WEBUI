import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

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
    render(<BackupsView backups={BACKUPS} />)

    expect(screen.getByText('sonarr')).toBeInTheDocument()
    expect(screen.getByText('sonarr-20260917-1200.tar.gz')).toBeInTheDocument()
    expect(screen.getByText('12.0 Mo')).toBeInTheDocument()
    expect(screen.getByText('2 Ko')).toBeInTheDocument()
  })

  it('renders an empty message', () => {
    render(<BackupsView backups={[]} />)

    expect(screen.getByText('Aucune sauvegarde.')).toBeInTheDocument()
  })
})
