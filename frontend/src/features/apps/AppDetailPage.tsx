import { useParams } from 'react-router-dom'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AppActions } from '@/features/apps/AppActions'
import { AppDetailView } from '@/features/apps/AppDetailView'
import { useAppAuth } from '@/features/apps/useAppAuth'
import { useBackups } from '@/features/backups/useBackups'
import { useApp, useAppEnv, useAppHistory, useAppStats } from '@/features/system/useSystem'
import { fr } from '@/i18n/fr'

export function AppDetailPage() {
  const { app = '' } = useParams()
  const detail = useApp(app)
  const auth = useAppAuth(app)
  const stats = useAppStats(app)
  const backups = useBackups()
  const history = useAppHistory(app, null)
  const env = useAppEnv(app)

  if (detail.isPending) {
    return <p className="text-sm text-muted-foreground">{fr.common.loading}</p>
  }

  if (detail.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{fr.common.error}</AlertTitle>
        <AlertDescription>{detail.error.message}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <AppActions app={detail.data} />
      <AppDetailView
        app={detail.data}
        auth={auth.data?.auth ?? null}
        stats={stats.data}
        backups={backups.data}
        history={history.data?.events}
        env={env.data?.variables}
      />
    </div>
  )
}
