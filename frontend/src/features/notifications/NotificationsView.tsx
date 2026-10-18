import { Link } from 'react-router-dom'

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

function formatDate(value: string): string {
  const iso = value.endsWith('Z') || value.includes('+') ? value : `${value}Z`
  return new Date(iso).toLocaleString('fr-FR')
}

export function NotificationsView({
  items,
  unread,
  busy,
  onRead,
  onReadAll,
}: {
  items: Notification[]
  unread: number
  busy: boolean
  onRead: (id: number) => void
  onReadAll: () => void
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

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{fr.notifications.empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((notification) => (
            <li
              key={notification.id}
              className={`rounded-xl border p-4 ${notification.read_at ? 'bg-card' : 'border-primary/20 bg-accent/30'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={SEVERITY_STYLES[notification.severity]}>
                      {notification.severity}
                    </Badge>
                    <span className="text-sm font-medium">{notification.title}</span>
                  </div>
                  {notification.message && (
                    <p className="mt-1 text-xs text-muted-foreground">{notification.message}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(notification.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
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
          ))}
        </ul>
      )}
    </div>
  )
}
