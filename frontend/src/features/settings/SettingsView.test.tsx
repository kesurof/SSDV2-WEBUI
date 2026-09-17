import { render, screen } from '@testing-library/react'
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

    expect(screen.getByText('Domaine')).toBeInTheDocument()
    expect(screen.getByText('exemple.tld')).toBeInTheDocument()
    expect(screen.getByText('Dépôt SSDV2')).toBeInTheDocument()
    expect(screen.getByText('/home/utilisateur/seedbox-compose')).toBeInTheDocument()
    expect(screen.getByText('Remote rclone (backups)')).toBeInTheDocument()
  })
})
