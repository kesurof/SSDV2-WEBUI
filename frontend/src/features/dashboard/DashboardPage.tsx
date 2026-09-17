import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { DashboardView } from '@/features/dashboard/DashboardView'
import { useJobs } from '@/features/jobs/useJobs'
import { useNotifications } from '@/features/notifications/useNotifications'
import { useMetrics, useSummary, useUpdates } from '@/features/system/useSystem'
import { fr } from '@/i18n/fr'

export function DashboardPage() {
  const summary = useSummary()
  const metrics = useMetrics()
  const jobs = useJobs()
  const notifications = useNotifications()
  const updates = useUpdates()

  if (summary.isPending) {
    return <p className="text-sm text-muted-foreground">{fr.common.loading}</p>
  }

  if (summary.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{fr.common.error}</AlertTitle>
        <AlertDescription>{summary.error.message}</AlertDescription>
      </Alert>
    )
  }

  return (
    <DashboardView
      summary={summary.data}
      metrics={metrics.data}
      jobs={jobs.data}
      notifications={notifications.data?.items}
      updatesCount={updates.data?.available}
    />
  )
}
