import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AppsTable } from '@/features/apps/AppsTable'
import type { AppState } from '@/api/types'

const APPS: AppState[] = [
  {
    name: 'sonarr',
    description: 'Gestion Séries',
    available: true,
    installed: true,
    runtime_status: 'running',
    healthy: true,
    url: 'https://sonarr.example.com',
    image: 'linuxserver/sonarr:latest',
    containers: 1,
    warnings: [],
  },
  {
    name: 'wallos',
    description: 'Budget',
    available: true,
    installed: false,
    runtime_status: 'not_installed',
    healthy: null,
    url: null,
    image: null,
    containers: 0,
    warnings: [],
  },
]

describe('AppsTable', () => {
  it('renders application rows with status', () => {
    render(<AppsTable apps={APPS} />)

    expect(screen.getByText('sonarr')).toBeInTheDocument()
    expect(screen.getByText('En marche')).toBeInTheDocument()
    expect(screen.getByText('wallos')).toBeInTheDocument()
    expect(screen.getByText('Non installé')).toBeInTheDocument()
    expect(screen.getByText('https://sonarr.example.com')).toBeInTheDocument()
  })

  it('shows an empty message', () => {
    render(<AppsTable apps={[]} />)
    expect(screen.getByText('Aucune application ne correspond à la recherche.')).toBeInTheDocument()
  })
})
