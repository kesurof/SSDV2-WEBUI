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
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'

import { apiUrl } from '@/api/url'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageSkeleton } from '@/components/app/page-skeleton'
import { BrandLogo, BrandMark } from '@/components/app/brand-logo'
import { ThemeToggle } from '@/components/app/theme-toggle'
import { UserMenu } from '@/components/app/user-menu'
import { meQueryKey, useLogout, useMe } from '@/features/auth/useAuth'
import { useNotifications } from '@/features/notifications/useNotifications'
import { useSetupStatus } from '@/features/setup/useSetup'
import { useApps, useHealth, useSummary } from '@/features/system/useSystem'
import { fr } from '@/i18n/fr'
import { useEventStream } from '@/lib/useEventStream'
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
  const authed = Boolean(me.data)
  const health = useHealth(authed)
  const summary = useSummary(authed)
  const notifications = useNotifications(authed)
  const apps = useApps(authed)
  const setup = useSetupStatus()
  const logout = useLogout()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [query, setQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const instanceName = setup.data?.instance_name ?? 'SSDV2 WebUI'
  const unread = notifications.data?.unread ?? 0

  useEffect(() => {
    document.title = instanceName
  }, [instanceName])

  useEventStream({
    key: authed ? 'notifications' : null,
    enabled: authed,
    buildUrl: (after) => apiUrl(`/notifications/events${after ? `?after=${after}` : ''}`),
    onMessage: (data) => {
      try {
        const payload = JSON.parse(data) as NotificationEventPayload
        if (payload.id) {
          queryClient.invalidateQueries({ queryKey: ['notifications'] })
        }
      } catch {
        // ignore les trames non JSON
      }
    },
    onAuthLost: () => {
      queryClient.setQueryData(meQueryKey, null)
    },
  })

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

  if (!me.isPending && !me.data) {
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
  const showShell = !me.isPending && me.data !== null

  return (
    <div className="control-shell flex min-h-svh bg-background">
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
          'fixed inset-y-0 left-0 z-40 flex w-62 flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-200 lg:sticky lg:top-0 lg:h-svh lg:translate-x-0',
          sidebarCollapsed && 'lg:w-20',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className={cn('flex min-h-20 items-center gap-2 border-b border-sidebar-border px-4 py-4', sidebarCollapsed && 'lg:flex-col lg:justify-center lg:gap-1 lg:px-2 lg:py-1.5')}>
          <div className={cn('min-w-0 flex-1', sidebarCollapsed && 'lg:hidden')}>
            <BrandLogo className="w-[130px]" />
            <div className="mt-1 truncate text-[11px] text-muted-foreground" title={instanceName}>
              {instanceName === 'SSDV2 WebUI' ? "Console d'administration" : instanceName}
            </div>
          </div>
          {sidebarCollapsed && <BrandMark className="hidden lg:block lg:size-7" />}
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn("ml-auto hidden shrink-0 text-muted-foreground lg:inline-flex", sidebarCollapsed && "lg:ml-0 lg:size-7")}
            aria-label={sidebarCollapsed ? 'Déployer la navigation' : 'Réduire la navigation'}
            title={sidebarCollapsed ? 'Déployer la navigation' : 'Réduire la navigation'}
            onClick={() => setSidebarCollapsed((value) => !value)}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="size-4" aria-hidden /> : <PanelLeftClose className="size-4" aria-hidden />}
          </Button>
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
              <div className={cn("px-2 pb-1.5 text-[11px] font-bold tracking-wider text-muted-foreground uppercase", sidebarCollapsed && "lg:sr-only")}>
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
                      title={item.label}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm transition-colors',
                          sidebarCollapsed && 'lg:justify-center',
                          isActive
                            ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                        )
                      }
                    >
                      <Icon className="size-5 shrink-0" aria-hidden />
                      <span className={cn("truncate", sidebarCollapsed && "lg:sr-only")}>{item.label}</span>
                      {badgeCount > 0 && (
                        <Badge className={cn("ml-auto border-transparent bg-primary text-primary-foreground", sidebarCollapsed && "lg:hidden")}>
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

        <div className={cn("border-t px-5 py-4 text-xs text-muted-foreground", sidebarCollapsed && "lg:px-2 lg:text-center")}>
          {!sidebarCollapsed && (summary.data?.ssdv2.branch ?? 'SSDV2')}
          {!sidebarCollapsed && summary.data?.ssdv2.commit ? ` · ${summary.data.ssdv2.commit.slice(0, 7)}` : ''}
          <div className={cn('mt-1 font-semibold', healthy ? 'text-success' : 'text-warning')}>
            ● <span className={cn(sidebarCollapsed && "lg:sr-only")}>{healthy ? fr.nav.systemOperational : fr.nav.systemDegraded}</span>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur lg:px-6">
          <Button
            variant="outline"
            size="icon"
            className="lg:hidden"
            aria-label="Ouvrir la navigation"
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
            <span className={cn("hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium md:inline-flex", healthy ? "text-success" : "text-warning")}>
              <span aria-hidden>●</span>{healthy ? fr.nav.systemOperational : fr.nav.systemDegraded}
            </span>
            <ThemeToggle />
            {me.data && (
              <UserMenu
                username={me.data.username}
                internalAuth={me.data.internal_auth}
                externalLogoutUrl={setup.data?.external_logout_url ?? null}
                onLogout={handleLogout}
              />
            )}
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

        <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 pb-10 lg:p-7">
          {showShell ? (
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          ) : (
            <PageSkeleton />
          )}
        </main>
        <nav aria-label="Navigation principale mobile" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-lg backdrop-blur lg:hidden">
          {[
            { to: '/dashboard', label: 'Accueil', icon: Gauge },
            { to: '/apps', label: 'Applications', icon: Boxes },
            { to: '/jobs', label: 'Jobs', icon: ListChecks },
          ].map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => cn('flex min-h-16 flex-col items-center justify-center gap-1 text-[11px]', isActive ? 'text-primary' : 'text-muted-foreground')}>
              <Icon className="size-5" aria-hidden />
              {label}
            </NavLink>
          ))}
          <button type="button" className="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground" aria-expanded={sidebarOpen} aria-label="Toutes les rubriques" onClick={() => setSidebarOpen(true)}>
            <Menu className="size-5" aria-hidden />
            Plus
          </button>
        </nav>
      </div>
    </div>
  )
}
