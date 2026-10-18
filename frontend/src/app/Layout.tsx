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
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { apiUrl } from '@/api/url'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { PageSkeleton } from '@/components/app/page-skeleton'
import { AppSidebar } from '@/components/app/app-sidebar'
import { mobilePageTitle } from '@/app/mobile-page-title'
import type { SidebarSection } from '@/components/app/app-sidebar'
import { ThemeToggle } from '@/components/app/theme-toggle'
import { UserMenu } from '@/components/app/user-menu'
import { meQueryKey, useLogout, useMe } from '@/features/auth/useAuth'
import { useNotifications } from '@/features/notifications/useNotifications'
import { useSetupStatus } from '@/features/setup/useSetup'
import { useApps, useHealth, useSummary } from '@/features/system/useSystem'
import { fr } from '@/i18n/fr'
import { useEventStream } from '@/lib/useEventStream'
import { useAutoHideHeader } from '@/hooks/use-auto-hide-header'
import { cn } from '@/lib/utils'

const NAV_SECTIONS: SidebarSection[] = [
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
  const location = useLocation()
  const { visible: headerVisible, setVisible: setHeaderVisible } = useAutoHideHeader()
  const queryClient = useQueryClient()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [query, setQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const instanceName = setup.data?.instance_name ?? 'SSDV2 WebUI'
  const unread = notifications.data?.unread ?? 0

  useEffect(() => {
    document.title = instanceName
  }, [instanceName])

  useEffect(() => {
    setHeaderVisible(true)
  }, [location.pathname, setHeaderVisible])

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    const closeOnDesktop = () => {
      if (media.matches) setSidebarOpen(false)
    }
    media.addEventListener?.('change', closeOnDesktop)
    return () => media.removeEventListener?.('change', closeOnDesktop)
  }, [])

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
        if (window.matchMedia?.('(max-width: 1023px)').matches) {
          setMobileSearchOpen(true)
        } else {
          searchRef.current?.focus()
        }
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
    setMobileSearchOpen(false)
    navigate(`/apps/${encodeURIComponent(name)}`)
  }

  const healthy = health.data?.status !== 'degraded'
  const showShell = !me.isPending && me.data !== null

  return (
    <div className="control-shell flex min-h-svh bg-background">
      <aside
        className={cn(
          'sticky top-0 hidden h-dvh min-h-0 shrink-0 overflow-hidden border-r border-sidebar-border lg:flex',
          sidebarCollapsed ? 'lg:w-20' : 'lg:w-62',
        )}
      >
        <AppSidebar
          sections={NAV_SECTIONS}
          instanceName={instanceName}
          branch={summary.data?.ssdv2.branch}
          commit={summary.data?.ssdv2.commit}
          healthy={healthy}
          unread={unread}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
        />
      </aside>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent className="lg:hidden">
          <SheetTitle className="sr-only">Navigation principale SSDv2</SheetTitle>
          <AppSidebar
            sections={NAV_SECTIONS}
            instanceName={instanceName}
            branch={summary.data?.ssdv2.branch}
            commit={summary.data?.ssdv2.commit}
            healthy={healthy}
            unread={unread}
            mobile
            onClose={() => setSidebarOpen(false)}
            onNavigate={() => setSidebarOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          data-testid="app-topbar"
          className={cn(
            'sticky top-0 z-20 flex h-16 items-center gap-2 border-b bg-card/95 px-3 backdrop-blur transition-transform duration-200 ease-out motion-reduce:transition-none lg:translate-y-0 lg:gap-3 lg:px-6',
            !(headerVisible || sidebarOpen || mobileSearchOpen) && '-translate-y-full',
          )}
        >
          <Button
            variant="outline"
            size="icon"
            className="size-10 shrink-0 lg:hidden"
            aria-label="Ouvrir la navigation"
            onClick={() => {
              setHeaderVisible(true)
              setSidebarOpen(true)
            }}
          >
            <Menu className="size-5" aria-hidden />
          </Button>

          <Button size="icon" variant="outline" className="size-12 shrink-0 lg:hidden" aria-label="Rechercher une application" onClick={() => setMobileSearchOpen(true)}>
            <Search className="size-5" aria-hidden />
          </Button>
          <div className="min-w-0 flex-1 truncate px-1 text-sm font-semibold lg:hidden">
            {mobilePageTitle(location.pathname)}
          </div>
          <div className="relative hidden w-full max-w-md lg:block">
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

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
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

        <Dialog open={mobileSearchOpen} onOpenChange={setMobileSearchOpen}>
          <DialogContent className="top-4 max-w-[calc(100%-1rem)] -translate-y-0 gap-3 p-4 sm:max-w-lg lg:hidden" showCloseButton={false}>
            <DialogHeader className="flex-row items-center justify-between gap-2">
              <DialogTitle>Rechercher une application</DialogTitle>
              <Button size="icon-sm" variant="ghost" aria-label={fr.common.close} onClick={() => setMobileSearchOpen(false)}>
                <X className="size-4" aria-hidden />
              </Button>
            </DialogHeader>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && results[0]) openApp(results[0].name)
                }}
                placeholder={fr.common.searchPlaceholder}
                aria-label="Recherche mobile d'application"
                className="h-11 w-full pl-9"
              />
            </div>
            <div className="max-h-[55svh] overflow-y-auto" aria-label="Résultats de recherche">
              {query.trim() && results.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">{fr.common.noResults}</p>
              ) : results.length > 0 ? (
                results.map((app) => (
                  <button
                    key={app.name}
                    type="button"
                    onClick={() => openApp(app.name)}
                    className="flex min-h-12 w-full min-w-0 items-center gap-3 border-b px-2 py-2 text-left last:border-b-0 hover:bg-secondary"
                  >
                    <Boxes className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{app.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{app.url ?? app.description}</span>
                    </span>
                  </button>
                ))
              ) : <p className="p-3 text-sm text-muted-foreground">{fr.common.searchPlaceholder}</p>}
            </div>
          </DialogContent>
        </Dialog>

        {health.data?.status === 'degraded' && (
          <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
            <AlertTitle>{fr.common.degraded}</AlertTitle>
            <AlertDescription className="text-xs">
              Docker : {String(health.data.docker)} — SSDV2 : {String(health.data.ssdv2)} —
              ssdv2ctl : {String(health.data.ssdv2ctl)} — Base : {String(health.data.database)}
            </AlertDescription>
          </Alert>
        )}

        <main className="mx-auto w-full max-w-[1600px] min-w-0 flex-1 p-4 pb-36 lg:p-7">
          {showShell ? (
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          ) : (
            <PageSkeleton />
          )}
        </main>
        {!sidebarOpen && (
          <Button
            size="icon"
            variant="secondary"
            aria-label="Ouvrir le menu de navigation"
            aria-expanded={false}
            aria-haspopup="dialog"
            className="fixed bottom-[calc(7rem+env(safe-area-inset-bottom,0px))] left-4 z-30 size-12 rounded-full border border-border bg-card text-foreground shadow-lg hover:bg-secondary focus-visible:ring-2 lg:hidden"
            onClick={() => {
              setHeaderVisible(true)
              setSidebarOpen(true)
            }}
          >
            <Menu className="size-5" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  )
}
