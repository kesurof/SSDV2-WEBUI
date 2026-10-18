import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { BrandLogo } from '@/components/app/brand-logo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRunSetup, useSetupStatus } from '@/features/setup/useSetup'
import { useHealth } from '@/features/system/useSystem'
import { fr } from '@/i18n/fr'

const STEPS = [fr.setup.stepAccount, fr.setup.stepSecurity, fr.setup.stepInstance, fr.setup.stepReview]

// Doit rester aligné sur `SetupRequest` (backend/app/schemas/setup.py).
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/

type AuthMode = 'internal' | 'proxy'

type FormState = {
  token: string
  username: string
  password: string
  confirm: string
  authMode: AuthMode
  instanceName: string
  notifyJobSuccess: boolean
}

export function SetupPage() {
  const status = useSetupStatus()
  const health = useHealth()
  const submit = useRunSetup()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({
    token: '',
    username: 'admin',
    password: '',
    confirm: '',
    authMode: 'internal',
    instanceName: 'SSDV2 WebUI',
    notifyJobSuccess: true,
  })

  // Si l'hébergeur impose un mode proxy validé, le montrer dans l'assistant.
  useEffect(() => {
    if (status.data?.auth_mode === 'proxy' && status.data.trusted_proxies_configured) {
      setForm((current) =>
        current.authMode === 'proxy' ? current : { ...current, authMode: 'proxy' },
      )
    }
  }, [status.data?.auth_mode, status.data?.trusted_proxies_configured])

  if (status.isPending) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-4">
        <Card className="w-full max-w-2xl border shadow-lg">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {fr.common.loading}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status.isError) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-4">
        <Card className="w-full max-w-2xl border shadow-lg">
          <CardHeader>
            <CardTitle>{fr.setup.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Alert variant="destructive">
              <AlertTitle>{fr.common.error}</AlertTitle>
              <AlertDescription>
                {status.error instanceof Error ? status.error.message : fr.login.unreachable}
              </AlertDescription>
            </Alert>
            <Button onClick={() => void status.refetch()}>{fr.common.retry}</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status.data && !status.data.required) {
    return <Navigate to="/login" replace />
  }

  const tokenValue = form.token.trim()
  const usernameValue = form.username.trim()
  const instanceNameValue = form.instanceName.trim()

  const tokenValid = tokenValue.length >= 8 && tokenValue.length <= 128
  const usernameValid = USERNAME_PATTERN.test(usernameValue)
  const usernameTooLong = usernameValue.length > 64
  const passwordTooShort = form.password.length > 0 && form.password.length < 12
  const passwordMismatch = form.confirm.length > 0 && form.password !== form.confirm
  const passwordSameAsUsername =
    form.password.length > 0 && form.password.toLowerCase() === usernameValue.toLowerCase()
  const accountValid =
    tokenValid &&
    usernameValue.length >= 3 &&
    usernameValid &&
    form.password.length >= 12 &&
    form.password.length <= 200 &&
    !passwordSameAsUsername &&
    form.password === form.confirm

  const externalAuth = status.data?.external_auth ?? false
  const proxyAvailable = status.data?.trusted_proxies_configured ?? false
  const securityValid = form.authMode === 'internal' || (proxyAvailable && externalAuth)
  const instanceValid = instanceNameValue.length >= 1 && instanceNameValue.length <= 100

  const canContinue =
    (step === 0 && accountValid) ||
    (step === 1 && securityValid) ||
    (step === 2 && instanceValid) ||
    step === 3

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function finish() {
    setError(null)
    submit.mutate(
      {
        token: form.token.trim(),
        username: form.username.trim(),
        password: form.password,
        auth_mode: form.authMode,
        instance_name: form.instanceName.trim(),
        notify_job_success: form.notifyJobSuccess,
      },
      {
        onSuccess: () => {
          navigate('/dashboard', { replace: true })
        },
        onError: (mutationError) => {
          setError(mutationError.message)
        },
      },
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-2xl border shadow-lg">
        <CardHeader className="space-y-4">
          <BrandLogo className="w-36" />
          <CardTitle className="text-xl">{fr.setup.title}</CardTitle>
          <CardDescription>
            {STEPS.map((label, index) => (
              <span key={label} className={index === step ? 'font-medium text-foreground' : ''}>
                {index > 0 && ' — '}
                {index + 1}. {label}
              </span>
            ))}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>{fr.common.error}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {step === 0 && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="setup-token">{fr.setup.token}</Label>
                <Input
                  id="setup-token"
                  value={form.token}
                  onChange={(event) => update('token', event.target.value)}
                />
                <p className="text-xs text-muted-foreground">{fr.setup.tokenHint}</p>
                {form.token.length > 0 && !tokenValid && (
                  <p className="text-xs text-destructive">{fr.setup.tokenInvalid}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="setup-username">{fr.setup.username}</Label>
                <Input
                  id="setup-username"
                  value={form.username}
                  onChange={(event) => update('username', event.target.value)}
                />
                <p
                  className={
                    usernameValue.length > 0 && !usernameValid
                      ? 'text-xs text-destructive'
                      : 'text-xs text-muted-foreground'
                  }
                >
                  {usernameValue.length > 0 && !usernameValid
                    ? usernameTooLong
                      ? fr.setup.usernameTooLong
                      : fr.setup.usernameInvalid
                    : fr.setup.usernameHint}
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="setup-password">{fr.setup.password}</Label>
                <Input
                  id="setup-password"
                  type="password"
                  value={form.password}
                  onChange={(event) => update('password', event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {passwordTooShort
                    ? fr.setup.passwordTooShort
                    : passwordSameAsUsername
                      ? fr.setup.passwordSameAsUsername
                      : fr.setup.passwordHint}
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="setup-confirm">{fr.setup.passwordConfirm}</Label>
                <Input
                  id="setup-confirm"
                  type="password"
                  value={form.confirm}
                  onChange={(event) => update('confirm', event.target.value)}
                />
                {passwordMismatch && (
                  <p className="text-xs text-destructive">{fr.setup.passwordMismatch}</p>
                )}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <Label>{fr.setup.authMode}</Label>
              <Alert variant="default">
                <AlertDescription>
                  {form.authMode === 'proxy'
                    ? externalAuth
                      ? fr.setup.externalAuthDetected
                      : fr.setup.authModeProxyUnavailable
                    : fr.setup.internalAuthStandard}
                </AlertDescription>
              </Alert>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="setup-instance">{fr.setup.instanceName}</Label>
                <Input
                  id="setup-instance"
                  value={form.instanceName}
                  onChange={(event) => update('instanceName', event.target.value)}
                />
                {instanceNameValue.length > 100 && (
                  <p className="text-xs text-destructive">{fr.setup.instanceNameTooLong}</p>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.notifyJobSuccess}
                  onChange={(event) => update('notifyJobSuccess', event.target.checked)}
                />
                {fr.setup.notifyJobSuccess}
              </label>
              <p className="text-xs text-muted-foreground">{fr.setup.notifyJobSuccessHint}</p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{fr.setup.environment}</Label>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      [fr.setup.docker, health.data?.docker],
                      [fr.setup.ssdv2, health.data?.ssdv2],
                      [fr.setup.ssdv2ctl, health.data?.ssdv2ctl],
                      [fr.setup.database, health.data?.database],
                    ] as const
                  ).map(([label, ok]) => (
                    <Badge
                      key={label}
                      variant="outline"
                      className={
                        ok
                          ? 'border-transparent bg-emerald-600 text-white'
                          : 'border-transparent bg-red-600 text-white'
                      }
                    >
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <div className="text-xs text-muted-foreground">{fr.setup.summary}</div>
                <ul className="list-inside list-disc">
                  <li>
                    {fr.setup.username} : {form.username}
                  </li>
                  <li>
                    {fr.setup.instanceName} : {form.instanceName}
                  </li>
                  <li>
                    {fr.setup.authMode} :{' '}
                    {form.authMode === 'proxy' ? fr.setup.authModeProxy : fr.setup.authModeInternal}
                  </li>
                  <li>
                    {fr.setup.notifyJobSuccess} : {form.notifyJobSuccess ? 'oui' : 'non'}
                  </li>
                </ul>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button
              variant="outline"
              disabled={step === 0 || submit.isPending}
              onClick={() => setStep((current) => current - 1)}
            >
              {fr.setup.previous}
            </Button>
            {step < 3 ? (
              <Button disabled={!canContinue} onClick={() => setStep((current) => current + 1)}>
                {fr.setup.next}
              </Button>
            ) : (
              <Button disabled={submit.isPending} onClick={finish}>
                {submit.isPending ? fr.setup.submitting : fr.setup.finish}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
