import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { fr } from '@/i18n/fr'
import type { Backup } from '@/api/types'

function formatDate(value: string): string {
  const iso = value.endsWith('Z') || value.includes('+') ? value : `${value}Z`
  return new Date(iso).toLocaleString('fr-FR')
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 ** 3) {
    return `${(bytes / 1024 ** 3).toFixed(1)} Go`
  }
  if (bytes >= 1024 ** 2) {
    return `${(bytes / 1024 ** 2).toFixed(1)} Mo`
  }
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`
}

export function BackupsView({ backups }: { backups: Backup[] }) {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">{fr.backups.title}</h1>
      <p className="text-xs text-muted-foreground">{fr.backups.hint}</p>
      {backups.length === 0 ? (
        <p className="text-sm text-muted-foreground">{fr.backups.empty}</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{fr.backups.columns.app}</TableHead>
                <TableHead>{fr.backups.columns.file}</TableHead>
                <TableHead>{fr.backups.columns.size}</TableHead>
                <TableHead>{fr.backups.columns.date}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backups.map((backup) => (
                <TableRow key={`${backup.app}/${backup.file}`}>
                  <TableCell className="font-medium">{backup.app}</TableCell>
                  <TableCell className="font-mono text-xs">{backup.file}</TableCell>
                  <TableCell>{formatSize(backup.size)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(backup.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
