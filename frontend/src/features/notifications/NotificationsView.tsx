import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { AppLink } from '@/components/app/app-link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/app/page-header'
import { fr } from '@/i18n/fr'
import type { Notification } from '@/api/types'

const SEVERITY_STYLES: Record<Notification['severity'], string> = {
  info: 'border-primary/20 bg-primary/10 text-primary',
  success: 'border-success/20 bg-success-soft text-success',
  warning: 'border-warning/20 bg-warning-soft text-warning',
  error: 'border-destructive/20 bg-destructive-soft text-destructive',
}

function parseDate(value: string): Date {
  return new Date(value.endsWith('Z') || value.includes('+') ? value : value + 'Z')
}

function dayKey(value: string): string {
  return parseDate(value).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatDate(value: string): string {
  return parseDate(value).toLocaleString('fr-FR')
}

export function NotificationsView({
  items,
  unread,
  busy,
  onRead,
  onReadAll,
  filter = 'all',
  onFilterChange,
  appByJobId = {},
}: {
  items: Notification[]
  unread: number
  busy: boolean
  onRead: (id: number) => void
  onReadAll: () => void
  filter?: 'all' | 'unread'
  onFilterChange?: (value: 'all' | 'unread') => void
  appByJobId?: Record<number, string>
}) {
  return (
    <div className="space-y-4">
      <PageHeader
        title={
          <>
            {fr.notifications.title}{' '}
            {unread > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({unread} {fr.notifications.unread})
              </span>
            )}
          </>
        }
        actions={
          <Button size="sm" variant="outline" disabled={unread === 0 || busy} onClick={onReadAll}>
            {fr.notifications.markAllRead}
          </Button>
        }
      />

      {onFilterChange && (
        <div role="group" aria-label="Filtrer les notifications" className="flex gap-1 border-b">
          {([
            { value: 'all', label: 'Toutes' },
            { value: 'unread', label: 'Non lues' },
          ] as const).map((option) => (
            <button key={option.value} type="button" aria-pressed={filter === option.value}
              className="control-tab-button" onClick={() => onFilterChange(option.value)}>
              {option.label}
            </button>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{fr.notifications.empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((notification, index) => {
            const match = notification.link?.match(/^\/jobs\/(\d+)(?:[/?#]|$)/)
            const appName = match ? appByJobId[Number(match[1])] : undefined
            const day = dayKey(notification.created_at)
            return (
            <Fragment key={notification.id}>
              {(index === 0 || day !== dayKey(items[index - 1].created_at)) && (
                <li className="pt-3 pb-1 text-xs font-semibold text-muted-foreground" aria-label={day}>{day}</li>
              )}
            <li
              className={`rounded-xl border p-4 ${notification.read_at ? 'bg-card' : 'border-primary/20 bg-accent/30'}`}
            >
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={SEVERITY_STYLES[notification.severity]}>
                      {notification.severity}
                    </Badge>
                    <span className="min-w-0 break-words text-sm font-medium">{notification.title}</span>
                  </div>
                  {notification.message && (
                    <p className="mt-1 break-words text-xs text-muted-foreground">{notification.message}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(notification.created_at)}
                  </p>
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-3">
                  {appName && <AppLink name={appName} className="text-xs" />}
                  {notification.link && (
                    <>
                      <Link to={notification.link} className="text-xs text-primary hover:underline">
                        {fr.notifications.open}
                      </Link>
                    </>
                  )}
                  {!notification.read_at && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => onRead(notification.id)}
                    >
                      {fr.notifications.markRead}
                    </Button>
                  )}
                </div>
              </div>
            </li>
            </Fragment>
            )
          })}
        </ul>
      )}
    </div>
  )
}
