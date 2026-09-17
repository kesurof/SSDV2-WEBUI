import { ArrowUpCircle, Play, RotateCw, Square } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { useAppAction } from '@/features/jobs/useJobs'
import type { AppAction } from '@/features/jobs/useJobs'
import { fr } from '@/i18n/fr'
import type { AppState, UpdateEntry } from '@/api/types'

function useRowAction(app: AppState) {
  const mutation = useAppAction(app.name)
  function run(kind: AppAction) {
    mutation.mutate(
      { action: kind },
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
  return { run, busy: mutation.isPending }
}

export function AppRowActions({ app }: { app: AppState }) {
  const { run, busy } = useRowAction(app)

  if (!app.installed) {
    return <span className="text-xs text-muted-foreground">{fr.common.none}</span>
  }

  const running = app.runtime_status === 'running' || app.runtime_status === 'partial'
  return (
    <div className="flex items-center gap-1">
      {running ? (
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={fr.actions.stop}
          title={fr.actions.stop}
          disabled={busy}
          onClick={() => run('stop')}
        >
          <Square className="size-4" aria-hidden />
        </Button>
      ) : (
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={fr.actions.start}
          title={fr.actions.start}
          disabled={busy}
          onClick={() => run('start')}
        >
          <Play className="size-4" aria-hidden />
        </Button>
      )}
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={fr.actions.restart}
        title={fr.actions.restart}
        disabled={busy}
        onClick={() => run('restart')}
      >
        <RotateCw className="size-4" aria-hidden />
      </Button>
    </div>
  )
}

export function AppRowUpdate({ app, update }: { app: AppState; update?: UpdateEntry }) {
  const { run, busy } = useRowAction(app)

  if (!app.installed) {
    return <span className="text-xs text-muted-foreground">{fr.common.none}</span>
  }
  if (update?.status === 'available') {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        aria-label={`${fr.updates.update} ${app.name}`}
        onClick={() => run('recreate')}
      >
        <ArrowUpCircle className="size-3.5 text-warning" aria-hidden />
        {fr.updates.update}
      </Button>
    )
  }
  if (update?.status === 'up_to_date') {
    return <span className="text-xs text-muted-foreground">{fr.updates.status.up_to_date}</span>
  }
  return <span className="text-xs text-muted-foreground">{fr.common.none}</span>
}
