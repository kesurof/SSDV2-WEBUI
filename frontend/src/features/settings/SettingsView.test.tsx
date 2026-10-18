import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SettingsView } from '@/features/settings/SettingsView'

describe('SettingsView', () => {
  it('renders configuration values with labels', () => {
    render(
      <SettingsView
        config={{
          'user.domain': 'exemple.tld',
          'settings.source': '/home/utilisateur/seedbox-compose',
          'rclone.remote': null,
        }}
      />,
    )

    expect(within(screen.getByRole('table')).getByText('Domaine')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('exemple.tld')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('Dépôt SSDV2')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('/home/utilisateur/seedbox-compose')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('Remote rclone (backups)')).toBeInTheDocument()
  })
})
