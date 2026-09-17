import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { AppDetailView } from '@/features/apps/AppDetailView'
import type { AppDetail } from '@/api/types'

const APP: AppDetail = {
  name: 'sonarr',
  description: 'Gestion Séries',
  available: true,
  installed: true,
  runtime_status: 'partial',
  healthy: false,
  url: 'https://sonarr.example.com',
  image: 'linuxserver/sonarr:latest',
  containers: 2,
  warnings: ['unhealthy'],
  container_list: [
    { name: 'db-sonarr', image: 'postgres:16', state: 'exited', health: null },
    {
      name: 'sonarr',
      image: 'linuxserver/sonarr:latest',
      state: 'running',
      health: 'unhealthy',
    },
  ],
  ssddb: { status: 2, subdomain: 'sonarr', port: 8989 },
  registries: {
    containers: ['sonarr', 'db-sonarr'],
    volumes: ['sonarr-config'],
    dns: ['sonarr.example.com'],
  },
}

function renderDetail(auth: string | null = 'authelia') {
  return render(
    <MemoryRouter>
      <AppDetailView app={APP} auth={auth} />
    </MemoryRouter>,
  )
}

describe('AppDetailView', () => {
  it('renders overview with status, url and alerts', () => {
    renderDetail()

    expect(screen.getByRole('heading', { name: 'sonarr' })).toBeInTheDocument()
    expect(screen.getByText('Partiel')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'https://sonarr.example.com' })).toBeInTheDocument()
    expect(screen.getByText('Conteneur en mauvaise santé')).toBeInTheDocument()
    expect(screen.getByText('8989')).toBeInTheDocument()
    expect(screen.getByText('authelia')).toBeInTheDocument()
  })

  it('renders containers, volumes and dns tabs', async () => {
    const user = userEvent.setup()
    renderDetail()

    await user.click(screen.getByRole('tab', { name: /Conteneurs/ }))
    expect(screen.getByText('db-sonarr')).toBeInTheDocument()
    expect(screen.getByText('postgres:16')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Volumes' }))
    expect(screen.getByText('sonarr-config')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Réseau / DNS' }))
    expect(screen.getByText('sonarr.example.com')).toBeInTheDocument()
  })
})
