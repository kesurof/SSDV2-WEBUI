import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader } from '@/components/app/page-header'
import { BrandPanel, BrandSectionHeading } from '@/components/app/brand-panel'
import { EmptyState } from '@/components/app/empty-state'
import { Archive, DatabaseBackup } from 'lucide-react'
import { AppLink } from '@/components/app/app-link'
import { MobileCards, MobileCard, MobileField } from '@/components/app/mobile-cards'
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
      <PageHeader title={fr.backups.title} subtitle={fr.backups.hint} />
      <BrandPanel as="div" className="flex min-w-0 items-center gap-3 p-4">
        <div className="ssdv2-resource-icon"><DatabaseBackup className="size-5" aria-hidden /></div>
        <div className="min-w-0 flex-1">
          <div className="ssdv2-eyebrow">Archives / stockage</div>
          <p className="mt-1 text-xs text-muted-foreground">{fr.backups.hint}</p>
        </div>
        <div className="ssdv2-metric-value shrink-0 font-mono text-2xl font-semibold tabular-nums">{backups.length}</div>
      </BrandPanel>
      <BrandSectionHeading>Historique des sauvegardes</BrandSectionHeading>
      {backups.length === 0 ? (
        <EmptyState icon={Archive} message={fr.backups.empty} illustrated />
      ) : (
        <>
          <MobileCards label="Sauvegardes (vue mobile)">
            {backups.map((backup) => (
              <MobileCard key={`${backup.app}/${backup.file}`}>
                <div className="flex min-w-0 items-center gap-3">
                  <div className="ssdv2-resource-icon"><Archive className="size-4" aria-hidden /></div>
                  <div className="min-w-0">
                    <AppLink name={backup.app} className="text-base font-semibold" />
                    <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{backup.file}</p>
                  </div>
                </div>
                <dl className="mt-3 space-y-2 border-t pt-3">
                  <MobileField label={fr.backups.columns.size}>{formatSize(backup.size)}</MobileField>
                  <MobileField label={fr.backups.columns.date}>{formatDate(backup.created_at)}</MobileField>
                </dl>
              </MobileCard>
            ))}
          </MobileCards>
          <div className="ssdv2-module-panel hidden lg:block">
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
                  <TableCell><AppLink name={backup.app} /></TableCell>
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
        </>
      )}
    </div>
  )
}
