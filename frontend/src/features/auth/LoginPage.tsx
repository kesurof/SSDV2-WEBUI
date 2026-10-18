import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { ApiError } from '@/api/client'
import { BrandLogo } from '@/components/app/brand-logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLogin, useMe } from '@/features/auth/useAuth'
import { useSetupStatus } from '@/features/setup/useSetup'
import { fr } from '@/i18n/fr'

function loginErrorMessage(error: unknown): string | null {
  if (!error) {
    return null
  }
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return fr.login.rateLimited
    }
    if (error.status === 401) {
      return fr.login.invalid
    }
    return `${fr.login.error} (${error.status}) : ${error.message}`
  }
  return fr.login.unreachable
}

export function LoginPage() {
  const me = useMe()
  const setup = useSetupStatus()
  const login = useLogin()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  if (setup.data?.required) {
    return <Navigate to="/setup" replace />
  }

  if (me.data) {
    return <Navigate to="/dashboard" replace />
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    login.mutate(
      { username, password },
      { onSuccess: () => navigate('/dashboard', { replace: true }) },
    )
  }

  const errorMessage = loginErrorMessage(login.error)

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4 lg:p-8">
      <div className="grid w-full max-w-[960px] overflow-hidden rounded-2xl border bg-card shadow-xl lg:min-h-[520px] lg:grid-cols-[1fr_1fr]">
        <aside className="control-login-accent hidden flex-col justify-between p-12 text-white lg:flex">
          <img src="/branding/ssdv2-horizontal-dark.svg" alt="SSDv2" className="w-44" />
          <div>
            <div className="mb-5 h-1 w-12 rounded-full bg-cyan-400" aria-hidden />
            <h1 className="text-3xl font-bold tracking-tight">Déployez. Gérez. Sécurisez.</h1>
            <p className="mt-4 max-w-sm text-sm leading-7 text-slate-300">Votre écosystème d’applications Docker, administré en toute simplicité.</p>
          </div>
          <p className="text-xs text-slate-400">SSDv2 · Console d'administration</p>
        </aside>
        <Card className="flex w-full flex-col justify-center rounded-none border-0 bg-card p-5 shadow-none sm:p-10">
        <CardHeader className="space-y-5">
          <BrandLogo className="w-36 lg:hidden" />
          <div>
            <CardTitle className="text-2xl">{fr.login.title}</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">Accédez à votre espace d’administration.</p>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="username">{fr.login.username}</Label>
              <Input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{fr.login.password}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending ? fr.login.submitting : fr.login.submit}
            </Button>
          </form>
        </CardContent>
        </Card>
      </div>
    </div>
  )
}
