import {
  BellRing,
  Boxes,
  ClipboardList,
  DatabaseBackup,
  DownloadCloud,
  Gauge,
  HeartPulse,
  ListChecks,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ThemeToggle } from '@/components/app/theme-toggle'
import { UserMenu } from '@/components/app/user-menu'
import { useLogout, useMe } from '@/features/auth/useAuth'
import { useNotifications } from '@/features/notifications/useNotifications'
import { useSetupStatus } from '@/features/setup/useSetup'
import { useApps, useHealth, useSummary } from '@/features/system/useSystem'
import { fr } from '@/i18n/fr'
import { cn } from '@/lib/utils'

type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  badge?: 'notifications' | 'updates'
}

const NAV_SECTIONS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: fr.nav.sections.pilotage,
    items: [
      { to: '/dashboard', label: fr.nav.dashboard, icon: Gauge },
      { to: '/apps', label: fr.nav.apps, icon: Boxes },
      { to: '/jobs', label: fr.nav.jobs, icon: ListChecks },
      { to: '/notifications', label: fr.nav.notifications, icon: BellRing, badge: 'notifications' },
      { to: '/audit', label: fr.nav.audit, icon: ClipboardList },
    ],
  },
  {
    label: fr.nav.sections.exploitation,
    items: [
      { to: '/health', label: fr.nav.health, icon: HeartPulse },
      { to: '/backups', label: fr.nav.backups, icon: DatabaseBackup },
      { to: '/diagnostics', label: fr.nav.diagnostics, icon: Wrench },
      { to: '/updates', label: fr.nav.updates, icon: DownloadCloud, badge: 'updates' },
    ],
  },
  {
    label: fr.nav.sections.configuration,
    items: [
      { to: '/auth', label: fr.nav.auth, icon: ShieldCheck },
      { to: '/settings', label: fr.nav.settings, icon: Settings },
    ],
  },
]

type NotificationEventPayload = {
  id?: number
}

export function Layout() {
  const me = useMe()
  const health = useHealth()
  const summary = useSummary()
  const notifications = useNotifications()
  const apps = useApps()
  const setup = useSetupStatus()
  const logout = useLogout()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const instanceName = setup.data?.instance_name ?? 'SSDV2 WebUI'
  const unread = notifications.data?.unread ?? 0

  useEffect(() => {
    document.title = instanceName
  }, [instanceName])

  useEffect(() => {
    const source = new EventSource('/api/v1/notifications/events')
    source.onmessage = (event) => {
      const payload = JSON.parse(event.data as string) as NotificationEventPayload
      if (payload.id) {
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
      }
    }
    return () => {
      source.close()
    }
  }, [queryClient])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) {
      return []
    }
    return (apps.data ?? [])
      .filter((app) =>
        `${app.name} ${app.description} ${app.url ?? ''} ${app.image ?? ''}`
          .toLowerCase()
          .includes(needle),
      )
      .slice(0, 8)
  }, [apps.data, query])

  if (setup.data?.required) {
    return <Navigate to="/setup" replace />
  }

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

  function openApp(name: string) {
    setQuery('')
    setSearchFocused(false)
    searchRef.current?.blur()
    navigate(`/apps/${name}`)
  }

  const badges: Record<string, number> = { notifications: unread, updates: 0 }
  const healthy = health.data?.status !== 'degraded'

  return (
    <div className="flex min-h-svh bg-background">
      {sidebarOpen && (
        <button
          type="button"
          aria-label={fr.common.close}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-62 flex-col border-r bg-sidebar text-sidebar-foreground transition-transform lg:sticky lg:top-0 lg:h-svh lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="grid size-8 place-items-center rounded-lg bg-primary font-extrabold text-primary-foreground">
            ◇
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{instanceName}</div>
            <div className="text-[11px] text-muted-foreground">Administration simplifiée</div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto lg:hidden"
            aria-label={fr.common.close}
            onClick={() => setSidebarOpen(false)}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <div className="px-2 pb-1.5 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                {section.label}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon
                  const badgeCount = item.badge ? badges[item.badge] : 0
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                          isActive
                            ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                        )
                      }
                    >
                      <Icon className="size-5 shrink-0" aria-hidden />
                      <span className="truncate">{item.label}</span>
                      {badgeCount > 0 && (
                        <Badge className="ml-auto border-transparent bg-primary text-primary-foreground">
                          {badgeCount}
                        </Badge>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t px-5 py-4 text-xs text-muted-foreground">
          {summary.data?.ssdv2.branch ?? 'SSDV2'}
          {summary.data?.ssdv2.commit ? ` · ${summary.data.ssdv2.commit.slice(0, 7)}` : ''}
          <div className={cn('mt-1 font-semibold', healthy ? 'text-success' : 'text-warning')}>
            ● {healthy ? fr.nav.systemOperational : fr.nav.systemDegraded}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur lg:px-6">
          <Button
            variant="outline"
            size="icon"
            className="lg:hidden"
            aria-label={fr.common.search}
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="size-4" aria-hidden />
          </Button>

          <div className="relative w-full max-w-md">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 150)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && results[0]) {
                  openApp(results[0].name)
                }
                if (event.key === 'Escape') {
                  setQuery('')
                  searchRef.current?.blur()
                }
              }}
              placeholder={fr.common.searchPlaceholder}
              className="pl-9"
              aria-label={fr.common.search}
            />
            <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground sm:block">
              ⌘K
            </kbd>
            {searchFocused && query.trim() !== '' && (
              <div className="absolute top-full right-0 left-0 z-30 mt-1 overflow-hidden rounded-xl border bg-popover shadow-lg">
                {results.length === 0 ? (
                  <div className="px-3 py-2.5 text-sm text-muted-foreground">
                    {fr.common.noResults}
                  </div>
                ) : (
                  results.map((app) => (
                    <button
                      key={app.name}
                      type="button"
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-secondary"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => openApp(app.name)}
                    >
                      <Boxes className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{app.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {app.url ?? app.description}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <UserMenu
              username={me.data.username}
              internalAuth={me.data.internal_auth}
              onLogout={handleLogout}
            />
          </div>
        </header>

        {health.data?.status === 'degraded' && (
          <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
            <AlertTitle>{fr.common.degraded}</AlertTitle>
            <AlertDescription className="text-xs">
              Docker : {String(health.data.docker)} — SSDV2 : {String(health.data.ssdv2)} —
              ssdv2ctl : {String(health.data.ssdv2ctl)} — Base : {String(health.data.database)}
            </AlertDescription>
          </Alert>
        )}

        <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 lg:p-7">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
