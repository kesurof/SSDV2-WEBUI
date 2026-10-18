import { Boxes, BellRing, Gauge } from 'lucide-react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { AppSidebar } from '@/components/app/app-sidebar'
import type { SidebarSection } from '@/components/app/app-sidebar'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

const SECTIONS: SidebarSection[] = [
  { label: 'Pilotage', items: [
    { to: '/dashboard', label: 'Dashboard', icon: Gauge },
    { to: '/apps', label: 'Applications', icon: Boxes },
    { to: '/notifications', label: 'Notifications', icon: BellRing, badge: 'notifications' },
  ] },
  { label: 'Configuration', items: [
    { to: '/settings', label: 'Paramètres', icon: Gauge },
  ] },
]

const props = {
  sections: SECTIONS,
  instanceName: 'SSDV2 WebUI',
  branch: 'main',
  commit: 'abcdef123456',
  healthy: true,
  unread: 3,
}

describe('AppSidebar scroll and navigation', () => {
  it('keeps the scrollable navigation independent of header and footer', () => {
    render(
      <MemoryRouter initialEntries={['/apps/sonarr']}>
        <AppSidebar {...props} />
      </MemoryRouter>,
    )

    const nav = screen.getByRole('navigation', { name: 'Navigation SSDv2' })
    expect(nav).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto', 'overscroll-y-contain')
    expect(nav).toHaveAttribute('tabindex', '0')
    expect(within(nav).getByRole('link', { name: 'Applications' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Notifications' })).toHaveTextContent('3')
    expect(screen.getByText(/main · abcdef1/)).toBeInTheDocument()
    expect(screen.getByText('Système opérationnel')).toBeInTheDocument()
  })

  it('supports collapsed desktop navigation with accessible link names', async () => {
    const user = userEvent.setup()
    const onToggleCollapse = vi.fn()
    render(
      <MemoryRouter>
        <AppSidebar {...props} collapsed onToggleCollapse={onToggleCollapse} />
      </MemoryRouter>,
    )
    const nav = screen.getByRole('navigation', { name: 'Navigation SSDv2' })
    expect(within(nav).getByRole('link', { name: 'Applications' })).toHaveAttribute('href', '/apps')
    await user.click(screen.getByRole('button', { name: 'Déployer la navigation' }))
    expect(onToggleCollapse).toHaveBeenCalledTimes(1)
  })

  it('closes a mobile drawer by navigation or explicit close action', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onNavigate = vi.fn()
    render(
      <MemoryRouter>
        <Dialog open>
          <DialogContent showCloseButton={false} className="control-sidebar-drawer">
            <DialogTitle className="sr-only">Navigation SSDv2</DialogTitle>
            <AppSidebar {...props} mobile onNavigate={onNavigate} onClose={onClose} />
          </DialogContent>
        </Dialog>
      </MemoryRouter>,
    )
    const nav = await screen.findByRole('navigation', { name: 'Navigation mobile SSDv2' })
    expect(nav).toHaveClass('overflow-y-auto')
    await user.click(within(nav).getByRole('link', { name: 'Applications' }))
    expect(onNavigate).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
