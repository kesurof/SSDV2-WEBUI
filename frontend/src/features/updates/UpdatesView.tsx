import { ArrowUpCircle, DownloadCloud, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { AppLink } from '@/components/app/app-link'
import { MobileCards, MobileCard, MobileField } from '@/components/app/mobile-cards'

import { EmptyState } from '@/components/app/empty-state'
import { PageHeader } from '@/components/app/page-header'
import { BrandPanel, BrandSectionHeading } from '@/components/app/brand-panel'
import { StatusPill } from '@/components/app/status-pill'
import type { StatusTone } from '@/components/app/status-pill'
import { Button } from '@/components/ui/button'
import type { UpdateEntry, Updates } from '@/api/types'
import { useAppAction } from '@/features/jobs/useJobs'
import { fr } from '@/i18n/fr'
import { formatDate } from '@/lib/format'

const STATUS_TONES: Record<string, StatusTone> = {
  up_to_date: 'ok',
  available: 'warn',
  unknown: 'muted',
}

function UpdateRow({ entry, onUpdated, mobile = false }: { entry: UpdateEntry; onUpdated: () => void; mobile?: boolean }) {
  const action = useAppAction(entry.app)

  async function launch() {
    try {
      const job = await action.mutateAsync({ action: 'update' })
      toast.success(fr.updates.updateLaunched.replace('{app}', entry.app).replace('{id}', String(job.id)))
      onUpdated()
    } catch {
      toast.error(fr.common.error)
    }
  }

  const updateButton = entry.status === 'available' ? (
    <Button size="sm" variant="outline" disabled={action.isPending} onClick={launch}>
      <ArrowUpCircle className="size-3.5" aria-hidden />
      {fr.updates.update}
    </Button>
  ) : null

  if (mobile) {
    return (
      <MobileCard>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <AppLink name={entry.app} className="break-all text-base font-semibold" />
          <StatusPill tone={STATUS_TONES[entry.status] ?? 'muted'}>{fr.updates.status[entry.status]}</StatusPill>
        </div>
        <dl className="mt-3 space-y-2 border-t pt-3">
          <MobileField label={fr.updates.columns.current}>
            <span className="break-all font-mono">{entry.current_digest ?? fr.common.none}</span>
          </MobileField>
          <MobileField label={fr.updates.columns.available}>
            <span className="break-all font-mono">
              {entry.available_digest && entry.status === 'available' ? entry.available_digest : fr.common.none}
            </span>
          </MobileField>
          <MobileField label={fr.updates.columns.type}>{fr.updates.types.application}</MobileField>
        </dl>
        {updateButton && <div className="mt-3 border-t pt-3">{updateButton}</div>}
      </MobileCard>
    )
  }

  return (
    <tr data-update-status={entry.status} className="ssdv2-update-row border-b last:border-b-0">
      <td className="px-3 py-2.5"><AppLink name={entry.app} /></td>
      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
        {entry.current_digest ?? fr.common.none}
      </td>
      <td className="px-3 py-2.5 font-mono text-xs">
        {entry.available_digest && entry.status === 'available' ? (
          <span className="font-semibold text-primary">{entry.available_digest}</span>
        ) : (
          fr.common.none
        )}
      </td>
      <td className="px-3 py-2.5 text-sm text-muted-foreground">{fr.updates.types.application}</td>
      <td className="px-3 py-2.5">
        <StatusPill tone={STATUS_TONES[entry.status] ?? 'muted'}>
          {fr.updates.status[entry.status]}
        </StatusPill>
      </td>
      <td className="px-3 py-2.5 text-right">
        {updateButton}
      </td>
    </tr>
  )
}

export function UpdatesView({
  updates,
  onRefresh,
}: {
  updates?: Updates
  onRefresh: () => void
}) {
  return (
    <div>
      <PageHeader
        title={fr.updates.title}
        subtitle={fr.updates.subtitle}
        actions={
          <>
            {updates ? (
              <span className="text-xs text-muted-foreground">
                {fr.updates.lastCheck} : {formatDate(updates.checked_at)}
              </span>
            ) : null}
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="size-3.5" aria-hidden />
              {fr.common.refresh}
            </Button>
          </>
        }
      />

      <BrandPanel as="div" className="mb-4 p-4 text-sm">
        <div className="flex items-center gap-2 font-medium">
          <DownloadCloud className="size-4 text-muted-foreground" aria-hidden />
          {updates && updates.available > 0
            ? fr.updates.countAvailable.replace('{count}', String(updates.available))
            : fr.updates.status.up_to_date}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{fr.updates.appsOnlyHint}</p>
      </BrandPanel>
      <BrandSectionHeading className="mb-3">Versions et disponibilité</BrandSectionHeading>

      {!updates ? (
        <EmptyState icon={DownloadCloud} message={fr.common.loading} />
      ) : updates.entries.length === 0 ? (
        <EmptyState icon={DownloadCloud} message={fr.updates.empty} illustrated />
      ) : (
        <>
          <MobileCards label="Mises à jour (vue mobile)">
            {updates.entries.map((entry) => (
              <UpdateRow key={entry.app} entry={entry} onUpdated={onRefresh} mobile />
            ))}
          </MobileCards>
          <div className="ssdv2-module-panel mt-4 hidden lg:block">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-secondary/60 text-left text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">{fr.updates.columns.component}</th>
                  <th className="px-3 py-2.5 font-semibold">{fr.updates.columns.current}</th>
                  <th className="px-3 py-2.5 font-semibold">{fr.updates.columns.available}</th>
                  <th className="px-3 py-2.5 font-semibold">{fr.updates.columns.type}</th>
                  <th className="px-3 py-2.5 font-semibold">{fr.updates.columns.status}</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {updates.entries.map((entry) => (
                  <UpdateRow key={entry.app} entry={entry} onUpdated={onRefresh} />
                ))}
              </tbody>
            </table>
          </div>
          </div>
        </>
      )}
      {updates && updates.entries.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">{fr.updates.unknownHint}</p>
      )}
    </div>
  )
}
