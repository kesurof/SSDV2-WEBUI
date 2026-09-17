import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { fr } from '@/i18n/fr'
import type { AuditEvent } from '@/api/types'

function formatDate(value: string): string {
  const iso = value.endsWith('Z') || value.includes('+') ? value : `${value}Z`
  return new Date(iso).toLocaleString('fr-FR')
}

export function AuditView({ events }: { events: AuditEvent[] }) {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">{fr.audit.title}</h1>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">{fr.audit.empty}</p>
      ) : (
        <div className="rounded-md border">
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
                  <TableCell>{event.target ?? '—'}</TableCell>
                  <TableCell>{event.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
