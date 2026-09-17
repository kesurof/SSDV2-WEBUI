import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useLogout, useMe } from '@/features/auth/useAuth'
import { useHealth } from '@/features/system/useHealth'
import { fr } from '@/i18n/fr'

export function Layout() {
  const me = useMe()
  const health = useHealth()
  const logout = useLogout()
  const navigate = useNavigate()

  if (me.isPending) {
    return <div className="p-8 text-sm text-muted-foreground">{fr.common.loading}</div>
  }

  if (!me.data) {
    return <Navigate to="/login" replace />
  }

  async function handleLogout() {
    await logout.mutateAsync()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-svh">
      <aside className="flex w-56 flex-col border-r bg-muted/20 p-3">
        <div className="px-2 py-3 text-sm font-semibold">SSDV2 WebUI</div>
        <nav className="flex-1 space-y-1">
          <NavLink
            to="/apps"
            className={({ isActive }) =>
              `block rounded-md px-2 py-1.5 text-sm ${
                isActive ? 'bg-accent font-medium' : 'text-muted-foreground hover:bg-accent/50'
              }`
            }
          >
            {fr.nav.apps}
          </NavLink>
        </nav>
        <div className="space-y-2 border-t p-2">
          <div className="truncate text-xs text-muted-foreground">{me.data.username}</div>
          <Button variant="outline" size="sm" className="w-full" onClick={handleLogout}>
            {fr.common.logout}
          </Button>
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        {health.data?.status === 'degraded' && (
          <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
            <AlertTitle>{fr.common.degraded}</AlertTitle>
            <AlertDescription className="text-xs">
              Docker : {String(health.data.docker)} — SSDV2 : {String(health.data.ssdv2)} —
              ssdv2ctl : {String(health.data.ssdv2ctl)} — Base :{' '}
              {String(health.data.database)}
            </AlertDescription>
          </Alert>
        )}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
