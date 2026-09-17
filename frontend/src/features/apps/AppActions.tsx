import { useState } from 'react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useAppAction } from '@/features/jobs/useJobs'
import type { AppAction } from '@/features/jobs/useJobs'
import { fr } from '@/i18n/fr'
import type { AppDetail } from '@/api/types'
import { useNavigate } from 'react-router-dom'

export function AppActions({ app }: { app: AppDetail }) {
  const action = useAppAction(app.name)
  const navigate = useNavigate()
  const [pending, setPending] = useState<AppAction | null>(null)

  const running = app.runtime_status === 'running' || app.runtime_status === 'partial'

  function submit(kind: AppAction) {
    setPending(null)
    action.mutate(kind, {
      onSuccess: (job) => {
        toast.success(fr.jobs.launched.replace('{id}', String(job.id)))
        navigate(`/jobs/${job.id}`)
      },
      onError: (error) => {
        toast.error(error.message)
      },
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={!app.installed || running || action.isPending}
        onClick={() => setPending('start')}
      >
        {fr.actions.start}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={!app.installed || !running || action.isPending}
        onClick={() => setPending('stop')}
      >
        {fr.actions.stop}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={!app.installed || action.isPending}
        onClick={() => setPending('restart')}
      >
        {fr.actions.restart}
      </Button>

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{fr.actions.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {pending
                ? fr.actions.confirmMessage
                    .replace('{action}', fr.actions[pending].toLowerCase())
                    .replace('{app}', app.name)
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{fr.actions.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => pending && submit(pending)}>
              {fr.actions.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
