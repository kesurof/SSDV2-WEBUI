import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SecurityWatchPage } from '@/features/security-watch/SecurityWatchPage'

describe('SecurityWatchPage', () => {
  it('propose le téléchargement authentifié et une analyse distincte', () => {
    render(<SecurityWatchPage />)

    expect(screen.getByRole('heading', { name: 'Audit de sécurité' })).toBeInTheDocument()
    const download = screen.getByRole('link', { name: 'Générer et télécharger' })
    expect(download).toHaveAttribute('href', '/api/v1/security-watch/inventory')
    expect(download).toHaveAttribute('download', 'ssdv2-security-inventory.json')

    const analyze = screen.getByRole('link', { name: 'Ouvrir Security Watch' })
    expect(analyze).toHaveAttribute(
      'href',
      'https://ssdv2-security-watch-public.kesurof.workers.dev/',
    )
    expect(analyze).toHaveAttribute('target', '_blank')
    expect(analyze).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByText(/Le fichier reste dans votre navigateur/)).toBeInTheDocument()
  })
})
