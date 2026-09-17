import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { DashboardView } from '@/features/dashboard/DashboardView'
import type { HostMetrics, SystemSummary } from '@/api/types'

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

const METRICS: HostMetrics = {
  schema_version: 1,
  cpu_percent: 12.0,
  cpu_count: 4,
  memory: { total_bytes: 8 * 1024 ** 3, used_bytes: 4 * 1024 ** 3, percent: 50.0 },
  disk: { total_bytes: 100 * 1024 ** 3, used_bytes: 28 * 1024 ** 3, percent: 28.0 },
  containers: { total: 10, running: 9, healthy: 8, unhealthy: 1, stopped: 1 },
  warnings: [],
}

describe('DashboardView', () => {
  it('renders host, metrics and ssdv2 summaries', () => {
    render(
      <MemoryRouter>
        <DashboardView
          summary={SUMMARY}
          metrics={METRICS}
          jobs={[]}
          notifications={[]}
          updatesCount={2}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('instance-exemple')).toBeInTheDocument()
    expect(screen.getByText('24.0 Go')).toBeInTheDocument()
    expect(screen.getByText('main')).toBeInTheDocument()
    expect(screen.getByText('0123456789')).toBeInTheDocument()
    expect(screen.getByText('183')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getAllByText('8').length).toBeGreaterThan(0)
    expect(screen.getByText('12 %')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Vue complète' })).toBeInTheDocument()
    expect(screen.getByText(/2 mise\(s\) à jour disponible\(s\)/)).toBeInTheDocument()
  })

  it('renders warnings', () => {
    render(
      <MemoryRouter>
        <DashboardView
          summary={{ ...SUMMARY, status: 'degraded', warnings: ['catalogue_unavailable'] }}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('Catalogue SSDV2 introuvable')).toBeInTheDocument()
  })
})
