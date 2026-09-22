import { ListChecks } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
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
    <div className="rounded-2xl border bg-card p-5">
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
    <div>
      <PageHeader title={fr.jobs.title} subtitle="Gérez et surveillez les tâches planifiées." />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
        <JobsView jobs={jobs.data} selectedId={selectedJob?.id} />
        <div className="h-fit lg:sticky lg:top-20">
          {selectedJob ? (
            <JobDetailPanel job={selectedJob} />
          ) : (
            <EmptyState icon={ListChecks} message={fr.jobs.empty} />
          )}
        </div>
      </div>
    </div>
  )
}
