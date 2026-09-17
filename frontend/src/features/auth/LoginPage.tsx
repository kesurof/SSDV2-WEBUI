import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { ApiError } from '@/api/client'
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
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{fr.login.title}</CardTitle>
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
  )
}
