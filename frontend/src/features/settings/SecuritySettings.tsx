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
import { useSecurity, useUpdateSecurity } from '@/features/settings/useSettings'
import { fr } from '@/i18n/fr'

const CONFIRM_PHRASE = 'DESACTIVER'

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
  )
}
