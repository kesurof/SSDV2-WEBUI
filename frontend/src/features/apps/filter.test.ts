import { describe, expect, it } from 'vitest'

import { filterApps } from '@/features/apps/filter'
import type { AppState } from '@/api/types'

function app(partial: Partial<AppState> & { name: string }): AppState {
  return {
    description: '',
    available: true,
    installed: false,
    runtime_status: 'not_installed',
    healthy: null,
    url: null,
    image: null,
    containers: 0,
    warnings: [],
    ...partial,
  }
}

const APPS: AppState[] = [
  app({ name: 'sonarr', description: 'Gestion Séries', installed: true, runtime_status: 'running', url: 'https://sonarr.example.com' }),
  app({ name: 'radarr', description: 'Gestion Films', installed: true, runtime_status: 'stopped' }),
  app({ name: 'wallos', description: 'Budget' }),
]

describe('filterApps', () => {
  it('filters by search term', () => {
    expect(filterApps(APPS, 'films', 'all').map((item) => item.name)).toEqual(['radarr'])
  })

  it('filters by status', () => {
    expect(filterApps(APPS, '', 'not_installed').map((item) => item.name)).toEqual(['wallos'])
    expect(filterApps(APPS, '', 'running').map((item) => item.name)).toEqual(['sonarr'])
    expect(filterApps(APPS, '', 'stopped').map((item) => item.name)).toEqual(['radarr'])
  })

  it('returns everything with the all filter', () => {
    expect(filterApps(APPS, '', 'all')).toHaveLength(3)
  })
})
