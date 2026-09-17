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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppAction } from '@/features/jobs/useJobs'
import type { AppAction } from '@/features/jobs/useJobs'
import { fr } from '@/i18n/fr'
import type { AppDetail } from '@/api/types'

const AUTH_TYPES = ['aucune', 'basique', 'authelia', 'oauth', 'oauth2-proxy'] as const
type AuthType = (typeof AUTH_TYPES)[number]

const CUSTOM_CONFIRMATIONS: Partial<Record<AppAction, string>> = {
  recreate: fr.actions.recreateConfirm,
  reinstall: fr.actions.reinstallConfirm,
}

export function AppActions({ app }: { app: AppDetail }) {
  const mutation = useAppAction(app.name)
  const navigate = useNavigate()
  const [pending, setPending] = useState<AppAction | null>(null)
  const [subdomain, setSubdomain] = useState(app.name)
  const [auth, setAuth] = useState<AuthType>('aucune')
  const [removeData, setRemoveData] = useState(false)
  const [confirmName, setConfirmName] = useState('')

  const running = app.runtime_status === 'running' || app.runtime_status === 'partial'
  const busy = mutation.isPending

  function submit(kind: AppAction, body?: Record<string, unknown>) {
    setPending(null)
    mutation.mutate(
      { action: kind, body },
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

  function confirmMessage(kind: AppAction): string {
    const template = CUSTOM_CONFIRMATIONS[kind]
    if (template) {
      return template.replace('{app}', app.name)
    }
    return fr.actions.confirmMessage
      .replace('{action}', fr.actions[kind].toLowerCase())
      .replace('{app}', app.name)
  }

  if (!app.installed) {
    return (
      <>
        <div className="flex items-center gap-2">
          <Button size="sm" disabled={busy} onClick={() => setPending('install')}>
            {fr.actions.install}
          </Button>
        </div>
        <Dialog open={pending === 'install'} onOpenChange={(open) => !open && setPending(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{fr.actions.installTitle.replace('{app}', app.name)}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="install-subdomain">{fr.actions.subdomain}</Label>
                <Input
                  id="install-subdomain"
                  value={subdomain}
                  onChange={(event) => setSubdomain(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="install-auth">{fr.actions.auth}</Label>
                <select
                  id="install-auth"
                  value={auth}
                  onChange={(event) => setAuth(event.target.value as AuthType)}
                  className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
                >
                  {AUTH_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPending(null)}>
                {fr.actions.cancel}
              </Button>
              <Button onClick={() => submit('install', { auth, subdomain })}>
                {fr.actions.confirm}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={running || busy}
        onClick={() => setPending('start')}
      >
        {fr.actions.start}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={!running || busy}
        onClick={() => setPending('stop')}
      >
        {fr.actions.stop}
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => setPending('restart')}>
        {fr.actions.restart}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button size="sm" variant="outline" disabled={busy} />}>
          {fr.actions.more}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => setPending('recreate')}>
            {fr.actions.recreate}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPending('reinstall')}>
            {fr.actions.reinstall}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPending('backup')}>
            {fr.actions.backup}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              setRemoveData(false)
              setConfirmName('')
              setPending('remove')
            }}
          >
            {fr.actions.remove}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={pending !== null && pending !== 'install' && pending !== 'remove'}
        onOpenChange={(open) => !open && setPending(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{fr.actions.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {pending ? confirmMessage(pending) : ''}
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

      <AlertDialog
        open={pending === 'remove'}
        onOpenChange={(open) => {
          if (!open) {
            setPending(null)
            setRemoveData(false)
            setConfirmName('')
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{fr.actions.removeTitle.replace('{app}', app.name)}</AlertDialogTitle>
            <AlertDialogDescription>
              {fr.actions.confirmMessage
                .replace('{action}', fr.actions.remove.toLowerCase())
                .replace('{app}', app.name)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <select
              aria-label={fr.actions.removeTitle.replace('{app}', app.name)}
              value={removeData ? 'delete' : 'keep'}
              onChange={(event) => setRemoveData(event.target.value === 'delete')}
              className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
            >
              <option value="keep">{fr.actions.removeKeep}</option>
              <option value="delete">{fr.actions.removeDelete}</option>
            </select>
            {removeData && (
              <div className="space-y-1">
                <Label htmlFor="remove-confirm">
                  {fr.actions.removeTypeToConfirm.replace('{app}', app.name)}
                </Label>
                <Input
                  id="remove-confirm"
                  value={confirmName}
                  onChange={(event) => setConfirmName(event.target.value)}
                />
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{fr.actions.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeData && confirmName !== app.name}
              onClick={() => submit('remove', { delete_data: removeData })}
            >
              {fr.actions.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
