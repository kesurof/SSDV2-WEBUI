import { Pagination } from '@/components/app/pagination'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { NotificationsView } from '@/features/notifications/NotificationsView'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/features/notifications/useNotifications'
import { usePageSlice } from '@/hooks/usePageSlice'
import { fr } from '@/i18n/fr'

const PAGE_SIZE = 20

export function NotificationsPage() {
  const notifications = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const { page, setPage, pageCount, pageItems } = usePageSlice(
    notifications.data?.items ?? [],
    PAGE_SIZE,
  )

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
    <div className="space-y-4">
      <NotificationsView
        items={pageItems}
        unread={notifications.data.unread}
        busy={markRead.isPending || markAllRead.isPending}
        onRead={(id) => markRead.mutate(id)}
        onReadAll={() => markAllRead.mutate()}
      />
      <Pagination
        page={page}
        pageCount={pageCount}
        total={notifications.data.items.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </div>
  )
}
