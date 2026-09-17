import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

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
    render(<AuditView events={EVENTS} />)

    expect(screen.getByText('app_install')).toBeInTheDocument()
    expect(screen.getByText('wallos')).toBeInTheDocument()
    expect(screen.getAllByText('admin')).toHaveLength(2)
    expect(screen.getByText('login')).toBeInTheDocument()
  })

  it('renders an empty message', () => {
    render(<AuditView events={[]} />)

    expect(screen.getByText('Aucun événement.')).toBeInTheDocument()
  })
})
