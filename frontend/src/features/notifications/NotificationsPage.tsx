import { useMemo, useState } from 'react'
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
import { useJobs } from '@/features/jobs/useJobs'

const PAGE_SIZE = 20

export function NotificationsPage() {
  const notifications = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const jobs = useJobs()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const filtered = useMemo(
    () => filter === 'unread'
      ? (notifications.data?.items ?? []).filter((item) => !item.read_at)
      : (notifications.data?.items ?? []),
    [notifications.data?.items, filter],
  )
  const appByJobId = useMemo(
    () => Object.fromEntries(
      (jobs.data ?? []).filter((job) => job.type.startsWith('app_')).map((job) => [job.id, job.target]),
    ),
    [jobs.data],
  )
  const { page, setPage, pageCount, pageItems } = usePageSlice(
    filtered,
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
        filter={filter}
        onFilterChange={(value) => { setFilter(value); setPage(0) }}
        appByJobId={appByJobId}
        busy={markRead.isPending || markAllRead.isPending}
        onRead={(id) => markRead.mutate(id)}
        onReadAll={() => markAllRead.mutate()}
      />
      <Pagination
        page={page}
        pageCount={pageCount}
        total={filtered.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </div>
  )
}
