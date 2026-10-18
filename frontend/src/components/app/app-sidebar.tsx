import type { LucideIcon } from 'lucide-react'
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { BrandLogo, BrandMark } from '@/components/app/brand-logo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { fr } from '@/i18n/fr'
import { cn } from '@/lib/utils'

export type SidebarItem = {
  to: string
  label: string
  icon: LucideIcon
  badge?: 'notifications' | 'updates'
}

export type SidebarSection = { label: string; items: SidebarItem[] }

export function AppSidebar({
  sections,
  instanceName,
  branch,
  commit,
  healthy,
  unread,
  collapsed = false,
  mobile = false,
  onClose,
  onToggleCollapse,
  onNavigate,
}: {
  sections: SidebarSection[]
  instanceName: string
  branch: string | null | undefined
  commit: string | null | undefined
  healthy: boolean
  unread: number
  collapsed?: boolean
  mobile?: boolean
  onClose?: () => void
  onToggleCollapse?: () => void
  onNavigate?: () => void
}) {
  const counts: Record<string, number> = { notifications: unread, updates: 0 }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground">
      <div className={cn(
        'flex min-h-20 shrink-0 items-center gap-2 border-b border-sidebar-border px-4 py-4',
        collapsed && 'lg:flex-col lg:justify-center lg:gap-1 lg:px-2 lg:py-1.5',
      )}>
        <div className={cn('min-w-0 flex-1', collapsed && 'lg:hidden')}>
          <BrandLogo className="w-[130px]" />
          <div className="mt-1 truncate text-[11px] text-muted-foreground" title={instanceName}>
            {instanceName === 'SSDV2 WebUI' ? "Console d'administration" : instanceName}
          </div>
        </div>
        {collapsed && <BrandMark className="hidden lg:block lg:size-7" />}
        {mobile ? (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto size-11 shrink-0"
            aria-label={fr.common.close}
            onClick={onClose}
          >
            <X className="size-6" aria-hidden />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn('ml-auto shrink-0 text-muted-foreground', collapsed && 'lg:ml-0 lg:size-7')}
            aria-label={collapsed ? 'Déployer la navigation' : 'Réduire la navigation'}
            title={collapsed ? 'Déployer la navigation' : 'Réduire la navigation'}
            onClick={onToggleCollapse}
          >
            {collapsed ? <PanelLeftOpen className="size-4" aria-hidden /> : <PanelLeftClose className="size-4" aria-hidden />}
          </Button>
        )}
      </div>

      <nav
        aria-label={mobile ? 'Navigation mobile SSDv2' : 'Navigation SSDv2'}
        data-testid="sidebar-scroll-region"
        tabIndex={0}
        className="control-sidebar-scroll min-h-0 min-w-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto overscroll-y-contain px-3 py-4"
      >
        {sections.map((section) => (
          <div key={section.label}>
            <div className={cn(
              'px-2 pb-1.5 text-[11px] font-bold tracking-wider text-muted-foreground uppercase',
              collapsed && 'lg:sr-only',
            )}>
              {section.label}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon
                const count = item.badge ? counts[item.badge] : 0
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={false}
                    aria-label={item.label}
                    onClick={onNavigate}
                    title={item.label}
                    className={({ isActive }) => cn(
                      'flex min-h-11 min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                      collapsed && 'lg:justify-center',
                      isActive
                        ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                    )}
                  >
                    <Icon className="size-5 shrink-0" aria-hidden />
                    <span className={cn('min-w-0 flex-1 truncate', collapsed && 'lg:sr-only')}>{item.label}</span>
                    {count > 0 && (
                      <Badge className={cn('ml-auto shrink-0 border-transparent bg-primary text-primary-foreground', collapsed && 'lg:hidden')}>
                        {count}
                      </Badge>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn(
        'min-w-0 shrink-0 border-t border-sidebar-border px-5 py-4 text-xs text-muted-foreground',
        mobile && 'pb-[max(1rem,env(safe-area-inset-bottom))]',
        collapsed && 'lg:px-2 lg:text-center',
      )}>
        {!collapsed && <div className="truncate">{branch ?? 'SSDV2'}{commit ? ' · ' + commit.slice(0, 7) : ''}</div>}
        <div className={cn('mt-1 font-semibold', healthy ? 'text-success' : 'text-warning')}>
          ● <span className={cn(collapsed && 'lg:sr-only')}>{healthy ? fr.nav.systemOperational : fr.nav.systemDegraded}</span>
        </div>
      </div>
    </div>
  )
}
