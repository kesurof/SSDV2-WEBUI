import { Link } from 'react-router-dom'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { JobStatusBadge } from '@/features/jobs/JobStatusBadge'
import { jobTypeLabel } from '@/features/jobs/JobsView'
import { fr } from '@/i18n/fr'
import type { Job } from '@/api/types'

export function JobDetailView({
  job,
  lines,
  done,
}: {
  job: Job
  lines: string[]
  done: boolean
}) {
  return (
    <div className="space-y-4">
      <div>
        <Link to="/jobs" className="text-xs text-muted-foreground hover:underline">
          {fr.jobs.back}
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">
            #{job.id} — {jobTypeLabel(job.type)} {job.target}
          </h1>
          <JobStatusBadge status={job.status} />
        </div>
      </div>

      {job.status === 'failed' && job.message && (
        <Alert variant="destructive">
          <AlertTitle>{fr.jobs.status.failed}</AlertTitle>
          <AlertDescription>{job.message}</AlertDescription>
        </Alert>
      )}

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
