import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { NotificationsView } from '@/features/notifications/NotificationsView'
import type { Notification } from '@/api/types'

const NOTIFICATIONS: Notification[] = [
  {
    id: 2,
    severity: 'error',
    title: 'Échec : Installation wallos',
    message: 'ssdv2ctl a retourné le code 1',
    source: 'jobs',
    link: '/jobs/12',
    created_at: '2026-09-17T10:00:00',
    read_at: null,
  },
  {
    id: 1,
    severity: 'success',
    title: 'Installation terminée : wallos',
    message: null,
    source: 'jobs',
    link: '/jobs/14',
    created_at: '2026-09-17T09:00:00',
    read_at: '2026-09-17T09:05:00',
  },
]

describe('NotificationsView', () => {
  it('renders notifications with unread count and actions', async () => {
    const user = userEvent.setup()
    const onRead = vi.fn()
    const onReadAll = vi.fn()

    render(
      <MemoryRouter>
        <NotificationsView
          items={NOTIFICATIONS}
          unread={1}
          busy={false}
          onRead={onRead}
          onReadAll={onReadAll}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText(/\(1 non lues\)/)).toBeInTheDocument()
    expect(screen.getByText('Échec : Installation wallos')).toBeInTheDocument()
    expect(screen.getByText('ssdv2ctl a retourné le code 1')).toBeInTheDocument()
    expect(
      screen.getAllByRole('link', { name: 'Ouvrir' }).map((link) => link.getAttribute('href')),
    ).toEqual(['/jobs/12', '/jobs/14'])

    await user.click(screen.getByRole('button', { name: 'Marquer comme lu' }))
    expect(onRead).toHaveBeenCalledWith(2)

    await user.click(screen.getByRole('button', { name: 'Tout marquer comme lu' }))
    expect(onReadAll).toHaveBeenCalled()
  })

  it('renders an empty message', () => {
    render(
      <MemoryRouter>
        <NotificationsView items={[]} unread={0} busy={false} onRead={vi.fn()} onReadAll={vi.fn()} />
      </MemoryRouter>,
    )

    expect(screen.getByText('Aucune notification.')).toBeInTheDocument()
  })
})
