import { Button } from '@/components/ui/button'
import { fr } from '@/i18n/fr'

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
}: {
  page: number
  pageCount: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>
        {total === 0 ? '0' : `${page * pageSize + 1}–${Math.min(total, (page + 1) * pageSize)}`} /{' '}
        {total}
      </span>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={page === 0}
          onClick={() => onPageChange(Math.max(0, page - 1))}
        >
          {fr.common.previous}
        </Button>
        <span>
          {page + 1} / {pageCount}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= pageCount - 1}
          onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))}
        >
          {fr.common.next}
        </Button>
      </div>
    </div>
  )
}
