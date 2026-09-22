import { Pagination } from '@/components/app/pagination'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AuditView } from '@/features/audit/AuditView'
import { useAuditEvents } from '@/features/notifications/useNotifications'
import { usePageSlice } from '@/hooks/usePageSlice'
import { fr } from '@/i18n/fr'

const PAGE_SIZE = 20

export function AuditPage() {
  const events = useAuditEvents()
  const { page, setPage, pageCount, pageItems } = usePageSlice(events.data ?? [], PAGE_SIZE)

  if (events.isPending) {
    return <p className="text-sm text-muted-foreground">{fr.common.loading}</p>
  }

  if (events.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{fr.common.error}</AlertTitle>
        <AlertDescription>{events.error.message}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <AuditView events={pageItems} />
      <Pagination
        page={page}
        pageCount={pageCount}
        total={events.data.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </div>
  )
}
