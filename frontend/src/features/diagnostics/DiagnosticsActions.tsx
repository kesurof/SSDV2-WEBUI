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
import { useDiagnosticsAction } from '@/features/diagnostics/useDiagnosticsAction'
import type { DiagnosticsAction } from '@/features/diagnostics/useDiagnosticsAction'
import { fr } from '@/i18n/fr'

const CONFIRM_PHRASE = 'SUPPRIMER'

const ACTIONS: {
  action: DiagnosticsAction
  label: string
  help: string
  destructive: boolean
}[] = [
  {
    action: 'rebuild-registries',
    label: fr.diagnostics.rebuildRegistries,
    help: fr.diagnostics.rebuildRegistriesHelp,
    destructive: false,
  },
  {
    action: 'cleanup-orphan-containers',
    label: fr.diagnostics.cleanupContainers,
    help: fr.diagnostics.cleanupContainersHelp,
    destructive: true,
  },
  {
    action: 'cleanup-dangling-volumes',
    label: fr.diagnostics.cleanupVolumes,
    help: fr.diagnostics.cleanupVolumesHelp,
    destructive: true,
  },
]

export function DiagnosticsActions() {
  const mutation = useDiagnosticsAction()
  const navigate = useNavigate()
  const [pending, setPending] = useState<DiagnosticsAction | null>(null)
  const [confirmation, setConfirmation] = useState('')

  const current = ACTIONS.find((item) => item.action === pending)

  function submit(action: DiagnosticsAction) {
    setPending(null)
    setConfirmation('')
    mutation.mutate(action, {
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
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{fr.diagnostics.actions}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{fr.diagnostics.actionsHelp}</p>
        <div className="flex flex-wrap gap-2">
          {ACTIONS.map((item) => (
            <Button
              key={item.action}
              size="sm"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => {
                setConfirmation('')
                setPending(item.action)
              }}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <ul className="space-y-1">
          {ACTIONS.map((item) => (
            <li key={item.action} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{item.label} : </span>
              {item.help}
            </li>
          ))}
        </ul>

        <AlertDialog
          open={pending !== null}
          onOpenChange={(open) => {
            if (!open) {
              setPending(null)
              setConfirmation('')
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{fr.actions.confirmTitle}</AlertDialogTitle>
              <AlertDialogDescription>
                {current?.destructive
                  ? fr.diagnostics.cleanupConfirm.replace(
                      '{resource}',
                      current.action === 'cleanup-orphan-containers'
                        ? fr.diagnostics.resourceContainers
                        : fr.diagnostics.resourceVolumes,
                    )
                  : fr.diagnostics.rebuildConfirm}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {current?.destructive && (
              <div className="space-y-1">
                <Label htmlFor="diagnostics-confirm">{fr.diagnostics.typeToConfirm}</Label>
                <Input
                  id="diagnostics-confirm"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>{fr.actions.cancel}</AlertDialogCancel>
              <AlertDialogAction
                disabled={Boolean(current?.destructive) && confirmation !== CONFIRM_PHRASE}
                onClick={() => pending && submit(pending)}
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
