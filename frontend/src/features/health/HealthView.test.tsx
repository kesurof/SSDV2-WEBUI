import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { HealthView } from '@/features/health/HealthView'
import type { HostMetrics, SystemHealth } from '@/api/types'

const HEALTH: SystemHealth = {
  schema_version: 1,
  status: 'ok',
  checked_at: '2026-09-17T10:00:00',
  services: [
    { key: 'docker', status: 'ok', detail: null },
    { key: 'ssdv2', status: 'ok', detail: null },
    { key: 'ssdv2ctl', status: 'ok', detail: null },
    { key: 'database', status: 'ok', detail: null },
    { key: 'backups', status: 'ok', detail: null },
    { key: 'jobs', status: 'ok', detail: null },
  ],
  tls: {
    status: 'ok',
    hostname: 'ssdv2.exemple.tld',
    days_remaining: 72,
    expires_at: '2026-11-28T10:00:00',
  },
  dns: { status: 'ok', hostname: 'ssdv2.exemple.tld', addresses: ['198.51.100.10'] },
  backups: { status: 'ok', last_at: '2026-09-17T02:00:00', count: 3 },
  jobs: { status: 'ok', active: 0, failed_recent: 0 },
  alerts: { status: 'warning', unread: 2 },
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

describe('HealthView', () => {
  it('renders metrics, checks and services', () => {
    render(
      <HealthView health={HEALTH} metrics={METRICS} updatesCount={3} onRefresh={() => {}} />,
    )

    expect(screen.getByRole('heading', { name: "Santé de l'infrastructure" })).toBeInTheDocument()
    expect(screen.getByText('12 %')).toBeInTheDocument()
    expect(screen.getAllByText('4 cœurs').length).toBeGreaterThan(0)
    expect(screen.getByText('50 %')).toBeInTheDocument()
    expect(screen.getByText('28 %')).toBeInTheDocument()
    expect(screen.getByText('9 sains')).toBeInTheDocument()
    expect(screen.getByText('1 en erreur')).toBeInTheDocument()
    expect(screen.getByText('3 disponibles')).toBeInTheDocument()
    expect(screen.getAllByText('Docker Engine').length).toBeGreaterThan(0)
    expect(screen.getByText('Valide')).toBeInTheDocument()
  })

  it('shows degraded status and failed DNS', () => {
    render(
      <HealthView
        health={{
          ...HEALTH,
          status: 'degraded',
          dns: { status: 'failed', hostname: 'ssdv2.exemple.tld', addresses: [] },
          tls: { status: 'unknown', hostname: null, days_remaining: null, expires_at: null },
        }}
        metrics={METRICS}
        onRefresh={() => {}}
      />,
    )

    expect(screen.getAllByText('Dégradé').length).toBeGreaterThan(0)
    expect(screen.getByText('Non résolu')).toBeInTheDocument()
    expect(screen.getByText('Inconnu')).toBeInTheDocument()
  })
})
