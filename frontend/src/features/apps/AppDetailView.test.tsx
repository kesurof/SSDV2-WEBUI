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
      <AppDetailView
        app={APP}
        auth={auth}
        env={[{ name: 'TZ', value: 'Europe/Paris' }]}
        stats={{
          schema_version: 1,
          app: 'sonarr',
          containers: [
            {
              name: 'sonarr',
              cpu_percent: 2.4,
              memory_used_bytes: 128 * 1024 * 1024,
              memory_limit_bytes: 1024 * 1024 * 1024,
              memory_percent: 12.5,
            },
          ],
        }}
        backups={[
          {
            app: 'sonarr',
            file: 'sonarr-20260917-0200.tar.gz',
            size: 22 * 1024 * 1024,
            created_at: '2026-09-17T02:00:00',
          },
        ]}
        history={[
          {
            kind: 'job',
            at: '2026-09-17T10:00:00',
            actor: 'admin',
            label: 'app_recreate',
            result: 'success',
            job_id: 12,
          },
        ]}
      />
    </MemoryRouter>,
  )
}

describe('AppDetailView', () => {
  it('renders overview with status, url and alerts', () => {
    renderDetail()

    expect(screen.getByRole('heading', { name: 'sonarr' })).toBeInTheDocument()
    expect(screen.getAllByText('Partiel').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'https://sonarr.example.com' })).toBeInTheDocument()
    expect(screen.getByText('Conteneur en mauvaise santé')).toBeInTheDocument()
    expect(screen.getByText('8989')).toBeInTheDocument()
    expect(screen.getByText('authelia')).toBeInTheDocument()
    expect(screen.getByText('Recréation')).toBeInTheDocument()
  })

  it('renders containers, volumes, dns and variables tabs', async () => {
    const user = userEvent.setup()
    renderDetail()

    await user.click(screen.getByRole('tab', { name: /Conteneurs/ }))
    expect(screen.getByText('db-sonarr')).toBeInTheDocument()
    expect(screen.getByText('postgres:16')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Volumes' }))
    expect(screen.getByText('sonarr-config')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Réseau / DNS' }))
    expect(screen.getByText('sonarr.example.com')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Variables' }))
    expect(screen.getByText('TZ')).toBeInTheDocument()
    expect(screen.getByText('Europe/Paris')).toBeInTheDocument()
  })
})
