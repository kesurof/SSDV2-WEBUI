import { ClipboardList, Download } from 'lucide-react'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/app/empty-state'
import { PageHeader } from '@/components/app/page-header'
import { StatusPill } from '@/components/app/status-pill'
import type { StatusTone } from '@/components/app/status-pill'
import { Button } from '@/components/ui/button'
import type { AppHistoryEvent } from '@/api/types'
import { jobTypeLabel } from '@/features/jobs/JobsView'
import { fr } from '@/i18n/fr'
import { formatDate } from '@/lib/format'

export type HistoryFilter = 'all' | 'job' | 'audit' | 'notification' | 'backup' | 'errors'

const FILTERS: Array<{ key: HistoryFilter; label: string }> = [
  { key: 'all', label: fr.history.filters.all },
  { key: 'job', label: fr.history.filters.jobs },
  { key: 'audit', label: fr.history.filters.audit },
  { key: 'notification', label: fr.history.filters.notifications },
  { key: 'backup', label: fr.history.filters.backups },
  { key: 'errors', label: fr.history.filters.errors },
]

function resultTone(result: string): StatusTone {
  if (['success', 'ok'].includes(result)) return 'ok'
  if (['failed', 'error'].includes(result)) return 'err'
  if (['warning', 'cancelled', 'interrupted'].includes(result)) return 'warn'
  return 'muted'
}

function eventLabel(event: AppHistoryEvent): string {
  if (event.kind === 'job') {
    return jobTypeLabel(event.label)
  }
  return event.label
}

function exportCsv(app: string, events: AppHistoryEvent[]) {
  const header = ['date', 'type', 'acteur', 'evenement', 'resultat']
  const rows = events.map((event) => [
    event.at,
    event.kind,
    event.actor ?? fr.history.system,
    eventLabel(event),
    event.result,
  ])
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `historique-${app}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function AppHistoryView({
  app,
  events,
  filter,
  onFilterChange,
  compact = false,
}: {
  app: string
  events?: AppHistoryEvent[]
  filter: HistoryFilter
  onFilterChange: (filter: HistoryFilter) => void
  compact?: boolean
}) {
  return (
    <div>
      {!compact && (
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/apps" className="font-semibold text-primary">
            {fr.nav.apps}
          </Link>
          <span>›</span>
          <Link to={`/apps/${app}`} className="font-semibold text-primary">
            {app}
          </Link>
          <span>›</span>
          <span>{fr.apps.tabs.history}</span>
        </div>
      )}

      {compact ? (
        <div className="mb-3 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            disabled={!events?.length}
            onClick={() => events && exportCsv(app, events)}
          >
            <Download className="size-3.5" aria-hidden />
            {fr.common.export}
          </Button>
        </div>
      ) : (
        <PageHeader
          title={fr.history.title.replace('{app}', app)}
          subtitle={fr.history.subtitle}
          actions={
            <Button
              variant="outline"
              size="sm"
              disabled={!events?.length}
              onClick={() => events && exportCsv(app, events)}
            >
              <Download className="size-3.5" aria-hidden />
              {fr.common.export}
            </Button>
          }
        />
      )}

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((item) => (
          <Button
            key={item.key}
            size="sm"
            variant={filter === item.key ? 'default' : 'outline'}
            onClick={() => onFilterChange(item.key)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {!events ? (
        <EmptyState icon={ClipboardList} message={fr.common.loading} />
      ) : events.length === 0 ? (
        <EmptyState icon={ClipboardList} message={fr.history.empty} />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-secondary/60 text-left text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">{fr.history.columns.date}</th>
                  <th className="px-3 py-2.5 font-semibold">{fr.history.columns.actor}</th>
                  <th className="px-3 py-2.5 font-semibold">{fr.history.columns.event}</th>
                  <th className="px-3 py-2.5 font-semibold">{fr.history.columns.result}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event, index) => (
                  <tr key={`${event.kind}-${event.at}-${index}`} className="border-b last:border-b-0">
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap text-muted-foreground">
                      {formatDate(event.at)}
                    </td>
                    <td className="px-3 py-2.5 text-xs">{event.actor ?? fr.history.system}</td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{eventLabel(event)}</span>
                        <span className="text-[11px] text-muted-foreground">{event.kind}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusPill tone={resultTone(event.result)}>{event.result}</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
