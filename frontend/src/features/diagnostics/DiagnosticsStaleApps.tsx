import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDiagnosticsPurge } from '@/features/diagnostics/useDiagnosticsAction'
import { fr } from '@/i18n/fr'

const CONFIRM_PHRASE = 'SUPPRIMER'

export function DiagnosticsStaleApps({ apps }: { apps: string[] }) {
  const purge = useDiagnosticsPurge()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<string[]>(apps)
  const [open, setOpen] = useState(false)
  const [deleteData, setDeleteData] = useState(false)
  const [confirmation, setConfirmation] = useState('')

  const selectedApps = selected.filter((app) => apps.includes(app))

  function toggle(app: string) {
    setSelected((current) =>
      current.includes(app) ? current.filter((item) => item !== app) : [...current, app],
    )
  }

  function submit() {
    setOpen(false)
    setConfirmation('')
    purge.mutate(
      { apps: selectedApps, deleteData },
      {
        onSuccess: (job) => {
          toast.success(fr.jobs.launched.replace('{id}', String(job.id)))
          navigate(`/jobs/${job.id}`)
        },
        onError: (error) => {
          toast.error(error.message)
        },
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{fr.diagnostics.staleTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {apps.length === 0 ? (
          <p className="text-sm text-muted-foreground">{fr.diagnostics.staleEmpty}</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{fr.diagnostics.staleHelp}</p>
            <ul className="space-y-1">
              {apps.map((app) => (
                <li key={app} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    aria-label={app}
                    checked={selectedApps.includes(app)}
                    onChange={() => toggle(app)}
                  />
                  <span className="font-mono text-xs">{app}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelected(apps)}>
                {fr.diagnostics.staleSelectAll}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={selectedApps.length === 0 || purge.isPending}
                onClick={() => {
                  setDeleteData(false)
                  setConfirmation('')
                  setOpen(true)
                }}
              >
                {fr.diagnostics.stalePurge} ({selectedApps.length})
              </Button>
            </div>
          </>
        )}

        <AlertDialog
          open={open}
          onOpenChange={(value) => {
            if (!value) {
              setOpen(false)
              setConfirmation('')
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{fr.diagnostics.staleConfirmTitle}</AlertDialogTitle>
              <AlertDialogDescription>
                {fr.diagnostics.staleWillRemove}
                {deleteData ? fr.diagnostics.staleWillRemoveData : ''}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="purge-data">{fr.diagnostics.staleDataLabel}</Label>
                <select
                  id="purge-data"
                  value={deleteData ? 'delete' : 'keep'}
                  onChange={(event) => setDeleteData(event.target.value === 'delete')}
                  className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
                >
                  <option value="keep">{fr.diagnostics.staleKeepData}</option>
                  <option value="delete">{fr.diagnostics.staleDeleteData}</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="purge-confirm">{fr.diagnostics.staleTypeToConfirm}</Label>
                <Input
                  id="purge-confirm"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>{fr.actions.cancel}</AlertDialogCancel>
              <AlertDialogAction
                disabled={confirmation !== CONFIRM_PHRASE}
                onClick={submit}
              >
                {fr.actions.confirm}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
