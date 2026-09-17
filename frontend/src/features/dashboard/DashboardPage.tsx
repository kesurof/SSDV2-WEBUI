import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { DashboardView } from '@/features/dashboard/DashboardView'
import { useSummary } from '@/features/system/useSystem'
import { fr } from '@/i18n/fr'

export function DashboardPage() {
  const summary = useSummary()

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

  return <DashboardView summary={summary.data} />
}
