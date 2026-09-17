import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { DashboardView } from '@/features/dashboard/DashboardView'
import type { SystemSummary } from '@/api/types'

const SUMMARY: SystemSummary = {
  status: 'ok',
  host: {
    hostname: 'instance-exemple',
    os: 'Ubuntu 24.04',
    kernel: '6.17.0',
    architecture: 'aarch64',
    cpus: 4,
    memory_bytes: 24 * 1024 ** 3,
    server_version: '29.6.1',
  },
  ssdv2: {
    branch: 'main',
    commit: '0123456789abcdef0123456789abcdef01234567',
    apps_total: 183,
    installed: 7,
    running: 8,
    stopped: 0,
    unknown: 0,
    not_installed: 176,
  },
  warnings: [],
}

describe('DashboardView', () => {
  it('renders host and ssdv2 summaries', () => {
    render(
      <MemoryRouter>
        <DashboardView summary={SUMMARY} />
      </MemoryRouter>,
    )

    expect(screen.getByText('instance-exemple')).toBeInTheDocument()
    expect(screen.getByText('24.0 Go')).toBeInTheDocument()
    expect(screen.getByText('main')).toBeInTheDocument()
    expect(screen.getByText('0123456789')).toBeInTheDocument()
    expect(screen.getByText('183')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voir les applications' })).toBeInTheDocument()
  })

  it('renders warnings', () => {
    render(
      <MemoryRouter>
        <DashboardView summary={{ ...SUMMARY, status: 'degraded', warnings: ['catalogue_unavailable'] }} />
      </MemoryRouter>,
    )

    expect(screen.getByText('Catalogue SSDV2 introuvable')).toBeInTheDocument()
  })
})
