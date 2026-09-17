import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { JobsView } from '@/features/jobs/JobsView'
import { useJobs } from '@/features/jobs/useJobs'
import { PageHeader } from '@/components/app/page-header'
import { fr } from '@/i18n/fr'

export function JobsPage() {
  const jobs = useJobs()

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

  return (
    <div className="space-y-4">
      <PageHeader title={fr.jobs.title} subtitle="Gérez et surveillez les tâches planifiées." />
      <JobsView jobs={jobs.data} />
    </div>
  )
}
