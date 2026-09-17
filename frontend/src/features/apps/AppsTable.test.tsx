import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

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
  function renderTable(apps: AppState[]) {
    return render(
      <MemoryRouter>
        <AppsTable apps={apps} />
      </MemoryRouter>,
    )
  }

  it('renders application rows with status', () => {
    renderTable(APPS)

    expect(screen.getByText('sonarr')).toBeInTheDocument()
    expect(screen.getByText('En marche')).toBeInTheDocument()
    expect(screen.getByText('wallos')).toBeInTheDocument()
    expect(screen.getByText('Non installé')).toBeInTheDocument()
    expect(screen.getByText('https://sonarr.example.com')).toBeInTheDocument()
  })

  it('links application names to the detail page', () => {
    renderTable(APPS)

    expect(screen.getByRole('link', { name: 'sonarr' })).toHaveAttribute('href', '/apps/sonarr')
  })

  it('shows an empty message', () => {
    renderTable([])
    expect(screen.getByText('Aucune application ne correspond à la recherche.')).toBeInTheDocument()
  })
})
