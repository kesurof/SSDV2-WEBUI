import { Badge } from '@/components/ui/badge'
import { fr } from '@/i18n/fr'
import type { AppState } from '@/api/types'

const VARIANTS: Record<AppState['runtime_status'], string> = {
  running: 'border-success/25 bg-success-soft text-success',
  partial: 'border-warning/25 bg-warning-soft text-warning',
  stopped: 'border-border bg-secondary/50 text-muted-foreground',
  unknown: 'border-warning/25 bg-warning-soft text-warning',
  not_installed: 'border-border bg-secondary/50 text-muted-foreground',
}

export function StatusBadge({ status }: { status: AppState['runtime_status'] }) {
  return (
    <Badge variant="outline" className={`gap-1.5 rounded-md text-[11px] font-medium ${VARIANTS[status]}`}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {fr.status[status]}
    </Badge>
  )
}
