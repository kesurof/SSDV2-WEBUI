import type { AppState } from '@/api/types'

export type StatusFilter = 'all' | 'installed' | 'not_installed' | 'running' | 'stopped'

export function filterApps(
  apps: AppState[],
  search: string,
  status: StatusFilter,
): AppState[] {
  const term = search.trim().toLowerCase()
  return apps.filter((app) => {
    if (term) {
      const haystack = [app.name, app.description, app.url ?? '', app.image ?? '']
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(term)) {
        return false
      }
    }
    switch (status) {
      case 'installed':
        return app.installed
      case 'not_installed':
        return !app.installed
      case 'running':
        return app.runtime_status === 'running'
      case 'stopped':
        return app.runtime_status === 'stopped'
      default:
        return true
    }
  })
}
