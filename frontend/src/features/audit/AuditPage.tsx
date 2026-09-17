import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AuditView } from '@/features/audit/AuditView'
import { useAuditEvents } from '@/features/notifications/useNotifications'
import { fr } from '@/i18n/fr'

export function AuditPage() {
  const events = useAuditEvents()

  if (events.isPending) {
    return <p className="text-sm text-muted-foreground">{fr.common.loading}</p>
  }

  if (events.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{fr.common.error}</AlertTitle>
        <AlertDescription>{events.error.message}</AlertDescription>
      </Alert>
    )
  }

  return <AuditView events={events.data} />
}
