import { fr } from '@/i18n/fr'

const LABELS: Record<string, string> = {
  dashboard: fr.nav.dashboard, apps: fr.nav.apps, jobs: fr.nav.jobs,
  notifications: fr.nav.notifications, audit: fr.nav.audit,
  health: fr.nav.health, backups: fr.nav.backups,
  diagnostics: fr.nav.diagnostics, updates: fr.nav.updates,
  auth: fr.nav.auth, settings: fr.nav.settings,
}

export function mobilePageTitle(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] === 'apps' && parts[2] === 'history') return fr.apps.tabs.history
  if (parts[0] === 'apps' && parts[1]) {
    try { return decodeURIComponent(parts[1]) } catch { return fr.nav.apps }
  }
  if (parts[0] === 'jobs' && parts[1]) return `Job #${parts[1]}`
  return LABELS[parts[0]] ?? 'SSDv2'
}
