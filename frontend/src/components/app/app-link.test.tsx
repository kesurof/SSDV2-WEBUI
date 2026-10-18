import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AppLink } from '@/components/app/app-link'

describe('AppLink', () => {
  it('navigates internally and encodes special characters', () => {
    render(<MemoryRouter><AppLink name="mon app" /></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'mon app' })).toHaveAttribute('href', '/apps/mon%20app')
  })
})
