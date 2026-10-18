import { useEffect, useState } from 'react'
import { toast } from 'sonner'

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
import { cn } from '@/lib/utils'

type AuthMode = 'internal' | 'proxy'

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
    <Card className="ssdv2-module-panel">
      <CardHeader className="ssdv2-card-header">
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
  const [selected, setSelected] = useState<AuthMode>('internal')

  const mode = (security.data?.mode ?? 'internal') as AuthMode
  const locked = security.data?.mode_source === 'env'
  const proxyAvailable = security.data?.trusted_proxies_configured ?? false

  useEffect(() => {
    if (security.data) {
      setSelected(security.data.mode as AuthMode)
    }
  }, [security.data])

  if (security.isPending) {
    return null
  }

  const canSave = !locked && !update.isPending && selected !== mode

  function submit() {
    update.mutate(selected, {
      onSuccess: () => toast.success(fr.security.saved),
      onError: (error) => toast.error(error.message),
    })
  }

  const options: Array<{ value: AuthMode; label: string; hint: string; disabled: boolean }> = [
    { value: 'internal', label: fr.security.internal, hint: fr.security.internalHint, disabled: false },
    {
      value: 'proxy',
      label: fr.security.proxy,
      hint: proxyAvailable ? fr.security.proxyHint : fr.security.proxyUnavailable,
      disabled: !proxyAvailable,
    },
  ]

  return (
    <div className="space-y-4">
      <Card className="ssdv2-module-panel">
        <CardHeader className="ssdv2-card-header">
          <CardTitle className="text-sm">{fr.security.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{fr.security.hint}</p>

          {locked && (
            <div className="rounded-md border bg-secondary/40 p-2 text-xs text-muted-foreground">
              {fr.security.envLocked}
            </div>
          )}

          <div className="space-y-2">
            {options.map((option) => (
              <label
                key={option.value}
                className={cn(
                  'ssdv2-auth-choice flex min-w-0 cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm',
                  selected === option.value ? 'border-primary bg-secondary/40' : '',
                  option.disabled && 'cursor-not-allowed opacity-60',
                )}
              >
                <input
                  type="radio"
                  name="auth-mode"
                  className="mt-0.5"
                  value={option.value}
                  checked={selected === option.value}
                  disabled={option.disabled || locked}
                  onChange={() => setSelected(option.value)}
                />
                <span>
                  <span className="block font-medium">{option.label}</span>
                  <span className="block text-xs text-muted-foreground">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <Badge variant="outline" className="border-transparent bg-secondary text-foreground">
              {fr.security.currentMode} : {mode === 'proxy' ? fr.security.proxy : fr.security.internal}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {fr.security.trustedConfigured} : {proxyAvailable ? 'oui' : 'non'}
            </span>
            <Button size="sm" className="ml-auto" disabled={!canSave} onClick={submit}>
              {fr.security.save}
            </Button>
          </div>
        </CardContent>
      </Card>

      {mode === 'internal' && <PasswordChangeCard />}
    </div>
  )
}
