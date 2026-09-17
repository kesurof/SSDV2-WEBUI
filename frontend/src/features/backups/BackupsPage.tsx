import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { BackupsView } from '@/features/backups/BackupsView'
import { useBackups } from '@/features/backups/useBackups'
import { fr } from '@/i18n/fr'

export function BackupsPage() {
  const backups = useBackups()

  if (backups.isPending) {
    return <p className="text-sm text-muted-foreground">{fr.common.loading}</p>
  }

  if (backups.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{fr.common.error}</AlertTitle>
        <AlertDescription>{backups.error.message}</AlertDescription>
      </Alert>
    )
  }

  return <BackupsView backups={backups.data} />
}
