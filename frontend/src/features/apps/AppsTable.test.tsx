import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { AppsTable } from '@/features/apps/AppsTable'
import type { AppState, UpdateEntry } from '@/api/types'

const APPS: AppState[] = [
  {
    name: 'sonarr',
    description: 'Gestion Séries',
    available: true,
    installed: true,
    runtime_status: 'running',
    healthy: true,
    url: 'https://sonarr.example.com',
    domain: 'sonarr.example.com',
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
    domain: null,
    image: null,
    containers: 0,
    warnings: [],
  },
]

describe('AppsTable', () => {
  function renderTable(apps: AppState[], updatesByApp?: Record<string, UpdateEntry>) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AppsTable apps={apps} updatesByApp={updatesByApp} />
        </MemoryRouter>
      </QueryClientProvider>,
    )
  }

  it('renders application rows with status', () => {
    renderTable(APPS)

    expect(screen.getByText('sonarr')).toBeInTheDocument()
    expect(screen.getByText('En marche')).toBeInTheDocument()
    expect(screen.getByText('wallos')).toBeInTheDocument()
    expect(screen.getByText('Non installé')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'sonarr.example.com' })).toHaveAttribute(
      'href',
      'https://sonarr.example.com',
    )
    expect(screen.getByRole('link', { name: 'Ouvrir l\'application sonarr' })).toHaveAttribute(
      'href',
      'https://sonarr.example.com',
    )
  })

  it('links application names to the detail page', () => {
    renderTable(APPS)

    expect(screen.getByRole('link', { name: 'sonarr' })).toHaveAttribute('href', '/apps/sonarr')
  })

  it('shows an empty message', () => {
    renderTable([])
    expect(screen.getByText('Aucune application ne correspond à la recherche.')).toBeInTheDocument()
  })

  it('shows quick actions and update state', () => {
    renderTable(APPS, {
      sonarr: {
        app: 'sonarr',
        image: 'linuxserver/sonarr:latest',
        current_digest: 'aaaa11112222',
        available_digest: 'bbbb33334444',
        status: 'available',
      },
    })

    expect(screen.getByRole('button', { name: 'Arrêter' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Redémarrer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mettre à jour sonarr' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Installer' })).not.toBeInTheDocument()
  })
})
