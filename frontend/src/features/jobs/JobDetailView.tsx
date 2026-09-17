import { RotateCw } from 'lucide-react'

import { KeyValueList } from '@/components/app/key-value-list'
import { StatusPill } from '@/components/app/status-pill'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { JobStatusBadge } from '@/features/jobs/JobStatusBadge'
import { jobTypeLabel } from '@/features/jobs/JobsView'
import { fr } from '@/i18n/fr'
import { formatDate } from '@/lib/format'
import type { Job } from '@/api/types'

function formatDuration(job: Job): string {
  if (!job.started_at || !job.finished_at) {
    return '—'
  }
  const start = new Date(job.started_at).getTime()
  const end = new Date(job.finished_at).getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return '—'
  }
  const seconds = Math.max(0, Math.round((end - start) / 1000))
  if (seconds < 60) {
    return `${seconds} s`
  }
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`
}

export function JobDetailView({
  job,
  lines,
  done,
  onRetry,
}: {
  job: Job
  lines: string[]
  done: boolean
  onRetry?: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">
            #{job.id} — {jobTypeLabel(job.type)} {job.target}
          </h2>
          <div className="mt-1.5 flex items-center gap-2">
            <JobStatusBadge status={job.status} />
            <span className="text-xs text-muted-foreground">{formatDate(job.created_at)}</span>
          </div>
        </div>
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCw className="size-3.5" aria-hidden />
            {fr.jobs.retry}
          </Button>
        ) : null}
      </div>

      {job.status === 'failed' && job.message && (
        <Alert variant="destructive">
          <AlertTitle>{fr.jobs.status.failed}</AlertTitle>
          <AlertDescription>{job.message}</AlertDescription>
        </Alert>
      )}

      <KeyValueList
        items={[
          { label: fr.jobs.columns.type, value: jobTypeLabel(job.type) },
          { label: fr.jobs.columns.target, value: job.target },
          { label: fr.jobs.detail.launchedAt, value: formatDate(job.created_at) },
          { label: fr.jobs.detail.duration, value: formatDuration(job) },
          {
            label: fr.jobs.detail.exitCode,
            value: job.exit_code === null ? '—' : String(job.exit_code),
          },
          {
            label: fr.jobs.detail.progress,
            value: (
              <StatusPill tone={done ? 'ok' : 'info'}>
                {done ? fr.jobs.detail.finished : fr.jobs.status.running}
              </StatusPill>
            ),
          },
        ]}
      />

      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">{fr.jobs.events}</div>
        <pre className="max-h-96 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs">
          {lines.length === 0
            ? done
              ? fr.apps.logs.empty
              : fr.common.loading
            : lines.join('\n')}
        </pre>
      </div>
    </div>
  )
}
