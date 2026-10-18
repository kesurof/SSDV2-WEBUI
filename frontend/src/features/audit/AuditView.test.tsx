import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { AuditView } from '@/features/audit/AuditView'
import type { AuditEvent } from '@/api/types'

const EVENTS: AuditEvent[] = [
  {
    id: 2,
    created_at: '2026-09-17T10:00:00',
    username: 'admin',
    action: 'app_install',
    target: 'wallos',
    status: 'success',
    detail: null,
  },
  {
    id: 1,
    created_at: '2026-09-17T09:00:00',
    username: 'admin',
    action: 'login',
    target: null,
    status: 'success',
    detail: null,
  },
]

describe('AuditView', () => {
  it('renders audit events', () => {
    render(<MemoryRouter><AuditView events={EVENTS} /></MemoryRouter>)

    const desktop = within(screen.getByRole('table'))
    expect(desktop.getByText('app_install')).toBeInTheDocument()
    expect(desktop.getByRole('link', { name: 'wallos' })).toHaveAttribute('href', '/apps/wallos')
    expect(desktop.getAllByText('admin')).toHaveLength(2)
    expect(desktop.getByText('login')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Audit (vue mobile)' })).getByRole('link', { name: 'wallos' })).toBeInTheDocument()
  })

  it('renders an empty message', () => {
    render(<AuditView events={[]} />)

    expect(screen.getByText('Aucun événement.')).toBeInTheDocument()
  })
})
