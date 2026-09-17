import { useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AppActions } from '@/features/apps/AppActions'
import { AppDetailView } from '@/features/apps/AppDetailView'
import { useAppAuth } from '@/features/apps/useAppAuth'
import { useBackups } from '@/features/backups/useBackups'
import { useAppAction } from '@/features/jobs/useJobs'
import {
  useApp,
  useAppEnv,
  useAppHistory,
  useAppStats,
  useAppStorage,
} from '@/features/system/useSystem'
import { fr } from '@/i18n/fr'

export function AppDetailPage() {
  const { app = '' } = useParams()
  const detail = useApp(app)
  const auth = useAppAuth(app)
  const stats = useAppStats(app)
  const backups = useBackups()
  const history = useAppHistory(app, null)
  const env = useAppEnv(app)
  const storage = useAppStorage(app)
  const recreate = useAppAction(app)

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

  function handleRecreate() {
    recreate.mutate(
      { action: 'recreate' },
      {
        onSuccess: (job) => {
          toast.success(fr.jobs.launched.replace('{id}', String(job.id)))
        },
        onError: (error) => {
          toast.error(error.message)
        },
      },
    )
  }

  return (
    <AppDetailView
      app={detail.data}
      auth={auth.data?.auth ?? null}
      stats={stats.data}
      backups={backups.data}
      history={history.data?.events}
      env={env.data?.variables}
      storage={storage.data}
      actions={<AppActions app={detail.data} />}
      onRecreate={detail.data.installed ? handleRecreate : undefined}
    />
  )
}
