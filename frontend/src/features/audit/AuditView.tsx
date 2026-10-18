import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader } from '@/components/app/page-header'
import { AppLink } from '@/components/app/app-link'
import { MobileCards, MobileCard, MobileField } from '@/components/app/mobile-cards'
import { fr } from '@/i18n/fr'
import type { AuditEvent } from '@/api/types'

function formatDate(value: string): string {
  const iso = value.endsWith('Z') || value.includes('+') ? value : `${value}Z`
  return new Date(iso).toLocaleString('fr-FR')
}

export function AuditView({ events }: { events: AuditEvent[] }) {
  return (
    <div className="space-y-4">
      <PageHeader
        title={fr.audit.title}
        subtitle="Historique des actions sensibles et changements administratifs."
      />
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">{fr.audit.empty}</p>
      ) : (
        <>
          <MobileCards label="Audit (vue mobile)">
            {events.map((event) => (
              <MobileCard key={event.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="min-w-0 break-all text-sm font-semibold">{event.action}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(event.created_at)}</span>
                </div>
                <dl className="mt-3 space-y-2 border-t pt-3">
                  <MobileField label={fr.audit.columns.user}>{event.username ?? '—'}</MobileField>
                  <MobileField label={fr.audit.columns.target}>
                    {event.target && event.action.startsWith('app_')
                      ? <AppLink name={event.target} />
                      : event.target ?? '—'}
                  </MobileField>
                  <MobileField label={fr.audit.columns.status}>{event.status}</MobileField>
                </dl>
              </MobileCard>
            ))}
          </MobileCards>
          <div className="hidden rounded-xl border bg-card lg:block">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{fr.audit.columns.date}</TableHead>
                <TableHead>{fr.audit.columns.user}</TableHead>
                <TableHead>{fr.audit.columns.action}</TableHead>
                <TableHead>{fr.audit.columns.target}</TableHead>
                <TableHead>{fr.audit.columns.status}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(event.created_at)}
                  </TableCell>
                  <TableCell>{event.username ?? '—'}</TableCell>
                  <TableCell>{event.action}</TableCell>
                  <TableCell>{event.target && event.action.startsWith('app_') ? <AppLink name={event.target} /> : event.target ?? '—'}</TableCell>
                  <TableCell>{event.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
