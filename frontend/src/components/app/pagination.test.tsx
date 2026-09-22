import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Pagination } from '@/components/app/pagination'

describe('Pagination', () => {
  it('renders range and disables boundaries', () => {
    render(
      <Pagination page={0} pageCount={3} total={45} pageSize={20} onPageChange={vi.fn()} />,
    )

    expect(screen.getByText(/1–20 \/ 45/)).toBeInTheDocument()
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Précédent' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Suivant' })).toBeEnabled()
  })

  it('calls onPageChange with the next page', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(
      <Pagination page={1} pageCount={3} total={45} pageSize={20} onPageChange={onPageChange} />,
    )

    await user.click(screen.getByRole('button', { name: 'Suivant' }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })
})
