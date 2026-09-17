import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { UserMenu } from '@/components/app/user-menu'

function openMenu(trigger: HTMLElement) {
  fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse', isPrimary: true })
  fireEvent.mouseDown(trigger, { button: 0 })
}

describe('UserMenu', () => {
  it('opens the menu with logout when internal auth is enabled', async () => {
    const onLogout = vi.fn()
    render(<UserMenu username="admin" internalAuth onLogout={onLogout} />)

    const trigger = screen.getByRole('button', { name: /admin/ })
    openMenu(trigger)

    const item = await screen.findByRole('menuitem', { name: /Déconnexion/ })
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(item)
    expect(onLogout).toHaveBeenCalledOnce()
  })

  it('renders a static chip without menu when internal auth is disabled', () => {
    render(<UserMenu username="auth-externe" internalAuth={false} onLogout={() => {}} />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('auth-externe')).toBeInTheDocument()
  })
})
