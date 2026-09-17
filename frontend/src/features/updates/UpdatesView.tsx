import { ArrowUpCircle, DownloadCloud, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/app/empty-state'
import { PageHeader } from '@/components/app/page-header'
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

function UpdateRow({ entry, onUpdated }: { entry: UpdateEntry; onUpdated: () => void }) {
  const action = useAppAction(entry.app)

  async function launch() {
    try {
      const job = await action.mutateAsync({ action: 'recreate' })
      toast.success(fr.updates.recreateLaunched.replace('{app}', entry.app).replace('{id}', String(job.id)))
      onUpdated()
    } catch {
      toast.error(fr.common.error)
    }
  }

  return (
    <tr className="border-b last:border-b-0">
      <td className="px-3 py-2.5 font-medium">{entry.app}</td>
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
        {entry.status === 'available' ? (
          <Button size="sm" variant="outline" disabled={action.isPending} onClick={launch}>
            <ArrowUpCircle className="size-3.5" aria-hidden />
            {fr.updates.update}
          </Button>
        ) : null}
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

      <div className="mb-4 rounded-2xl border bg-card p-4 text-sm">
        <div className="flex items-center gap-2 font-medium">
          <DownloadCloud className="size-4 text-muted-foreground" aria-hidden />
          {updates && updates.available > 0
            ? fr.updates.countAvailable.replace('{count}', String(updates.available))
            : fr.updates.status.up_to_date}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{fr.updates.appsOnlyHint}</p>
      </div>

      {!updates ? (
        <EmptyState icon={DownloadCloud} message={fr.common.loading} />
      ) : updates.entries.length === 0 ? (
        <EmptyState icon={DownloadCloud} message={fr.updates.empty} />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
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
          <p className="border-t px-3 py-2 text-xs text-muted-foreground">{fr.updates.unknownHint}</p>
        </div>
      )}
    </div>
  )
}
