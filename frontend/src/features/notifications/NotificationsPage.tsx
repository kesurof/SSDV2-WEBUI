import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { NotificationsView } from '@/features/notifications/NotificationsView'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/features/notifications/useNotifications'
import { fr } from '@/i18n/fr'

export function NotificationsPage() {
  const notifications = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  if (notifications.isPending) {
    return <p className="text-sm text-muted-foreground">{fr.common.loading}</p>
  }

  if (notifications.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{fr.common.error}</AlertTitle>
        <AlertDescription>{notifications.error.message}</AlertDescription>
      </Alert>
    )
  }

  return (
    <NotificationsView
      items={notifications.data.items}
      unread={notifications.data.unread}
      busy={markRead.isPending || markAllRead.isPending}
      onRead={(id) => markRead.mutate(id)}
      onReadAll={() => markAllRead.mutate()}
    />
  )
}
