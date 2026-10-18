import { ArrowLeft, ListChecks } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { EmptyState } from '@/components/app/empty-state'
import { PageHeader } from '@/components/app/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { JobDetailView } from '@/features/jobs/JobDetailView'
import { JobsView } from '@/features/jobs/JobsView'
import { useAppAction, useJobs, useSubmitJobInput } from '@/features/jobs/useJobs'
import type { AppAction } from '@/features/jobs/useJobs'
import { useJobEvents } from '@/features/jobs/useJobEvents'
import { fr } from '@/i18n/fr'
import { cn } from '@/lib/utils'
import type { Job } from '@/api/types'

function JobDetailPanel({ job }: { job: Job }) {
  const { lines, done, prompt, dismissPrompt } = useJobEvents(String(job.id))
  const jobInput = useSubmitJobInput(String(job.id))
  const action = useAppAction(job.target)
  const navigate = useNavigate()

  function submitInput(value: string) {
    if (!prompt) {
      return
    }
    jobInput.mutate(
      { promptId: prompt.id, value },
      {
        onSuccess: () => dismissPrompt(),
        onError: (error) => toast.error(error.message),
      },
    )
  }

  const retryAction = job.type.startsWith('app_') ? (job.type.slice(4) as AppAction) : null

  function retry() {
    if (!retryAction) {
      return
    }
    action.mutate(
      { action: retryAction },
      {
        onSuccess: (created) => {
          toast.success(fr.jobs.launched.replace('{id}', String(created.id)))
          navigate(`/jobs/${created.id}`)
        },
        onError: (error) => {
          toast.error(error.message)
        },
      },
    )
  }

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-xl border bg-card p-3.5 sm:p-5">
      <JobDetailView
        job={job}
        lines={lines}
        done={done}
        prompt={prompt}
        onInput={submitInput}
        onRetry={retryAction ? retry : undefined}
      />
    </div>
  )
}

export function JobsPage() {
  const params = useParams()
  const jobs = useJobs()
  const selectedId = params.id ? Number(params.id) : undefined

  if (jobs.isPending) {
    return <p className="text-sm text-muted-foreground">{fr.common.loading}</p>
  }

  if (jobs.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{fr.common.error}</AlertTitle>
        <AlertDescription>{jobs.error.message}</AlertDescription>
      </Alert>
    )
  }

  const selectedJob = selectedId
    ? jobs.data.find((job) => job.id === selectedId)
    : jobs.data[0]

  return (
    <div className="min-w-0 w-full max-w-full pb-20 lg:pb-0">
      <PageHeader title={fr.jobs.title} subtitle="Gérez et surveillez les tâches planifiées." />
      <div className="grid min-w-0 w-full grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        <section
          aria-label="Liste des jobs"
          data-testid="jobs-list-panel"
          className={cn('min-w-0 max-w-full', selectedId !== undefined && 'hidden lg:block')}
        >
          <JobsView jobs={jobs.data} selectedId={selectedJob?.id} />
        </section>
        <section
          aria-label="Détail du job"
          data-testid="jobs-detail-panel"
          className={cn('min-w-0 max-w-full lg:sticky lg:top-20 lg:h-fit', selectedId === undefined && 'hidden lg:block')}
        >
          {selectedId !== undefined && (
            <Link
              to="/jobs"
              className="mb-3 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:hidden"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Retour aux jobs
            </Link>
          )}
          {selectedJob ? (
            <JobDetailPanel key={selectedJob.id} job={selectedJob} />
          ) : (
            <EmptyState icon={ListChecks} message={fr.jobs.empty} />
          )}
        </section>
      </div>
    </div>
  )
}
