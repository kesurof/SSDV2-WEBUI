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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useChangePassword,
  useSecurity,
  useUpdateSecurity,
} from '@/features/settings/useSettings'
import { fr } from '@/i18n/fr'

const CONFIRM_PHRASE = 'DESACTIVER'

function PasswordChangeCard() {
  const change = useChangePassword()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')

  const tooShort = newPassword.length > 0 && newPassword.length < 12
  const sameAsCurrent = newPassword.length > 0 && newPassword === currentPassword
  const mismatch = confirmation.length > 0 && newPassword !== confirmation
  const valid =
    currentPassword.length > 0 &&
    newPassword.length >= 12 &&
    newPassword !== currentPassword &&
    newPassword === confirmation

  function submit() {
    change.mutate(
      { current_password: currentPassword, new_password: newPassword },
      {
        onSuccess: () => {
          toast.success(fr.security.passwordChanged)
          setCurrentPassword('')
          setNewPassword('')
          setConfirmation('')
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
        <CardTitle className="text-sm">{fr.security.passwordTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="security-current-password">{fr.security.currentPassword}</Label>
          <Input
            id="security-current-password"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="security-new-password">{fr.security.newPassword}</Label>
          <Input
            id="security-new-password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <p
            className={
              tooShort || sameAsCurrent ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'
            }
          >
            {tooShort
              ? fr.security.passwordTooShort
              : sameAsCurrent
                ? fr.security.passwordSameAsCurrent
                : fr.security.passwordHint}
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="security-confirm-password">{fr.security.passwordConfirm}</Label>
          <Input
            id="security-confirm-password"
            type="password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
          {mismatch && <p className="text-xs text-destructive">{fr.security.passwordMismatch}</p>}
        </div>
        <Button size="sm" disabled={!valid || change.isPending} onClick={submit}>
          {fr.security.changePassword}
        </Button>
      </CardContent>
    </Card>
  )
}

export function SecuritySettings() {
  const security = useSecurity()
  const update = useUpdateSecurity()
  const [pending, setPending] = useState<'enable' | 'disable' | null>(null)
  const [confirmation, setConfirmation] = useState('')

  if (security.isPending) {
    return null
  }

  const enabled = security.data?.internal_auth ?? true

  function submit() {
    const nextInternalAuth = pending === 'enable'
    setPending(null)
    setConfirmation('')
    update.mutate(nextInternalAuth, {
      onSuccess: () => {
        toast.success(nextInternalAuth ? fr.security.enabled : fr.security.disabled)
      },
      onError: (error) => {
        toast.error(error.message)
      },
    })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{fr.security.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{fr.security.hint}</p>
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className={
                enabled
                  ? 'border-transparent bg-emerald-600 text-white'
                  : 'border-transparent bg-amber-500 text-white'
              }
            >
              {enabled ? fr.security.enabled : fr.security.disabled}
            </Badge>
            <Button
              size="sm"
              variant={enabled ? 'destructive' : 'default'}
              disabled={update.isPending}
              onClick={() => {
                setConfirmation('')
                setPending(enabled ? 'disable' : 'enable')
              }}
            >
              {enabled ? fr.security.disable : fr.security.enable}
            </Button>
          </div>
        </CardContent>

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
                {pending === 'disable' ? fr.security.confirmDisable : fr.security.confirmEnable}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {pending === 'disable' && (
              <div className="space-y-1">
                <Label htmlFor="security-confirm">{fr.security.typeToConfirm}</Label>
                <Input
                  id="security-confirm"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>{fr.actions.cancel}</AlertDialogCancel>
              <AlertDialogAction
                disabled={pending === 'disable' && confirmation !== CONFIRM_PHRASE}
                onClick={submit}
              >
                {fr.actions.confirm}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>

      {enabled && <PasswordChangeCard />}
    </div>
  )
}
