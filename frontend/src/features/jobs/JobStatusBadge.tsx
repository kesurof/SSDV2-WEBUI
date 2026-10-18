import { Badge } from '@/components/ui/badge'
import { fr } from '@/i18n/fr'
import type { Job } from '@/api/types'

const VARIANTS: Record<Job['status'], string> = {
  queued: 'text-muted-foreground',
  running: 'border-primary/25 bg-accent text-accent-foreground',
  success: 'border-success/25 bg-success-soft text-success',
  failed: 'border-destructive/25 bg-destructive-soft text-destructive',
  cancelled: 'text-muted-foreground',
  interrupted: 'border-warning/25 bg-warning-soft text-warning',
}

export function JobStatusBadge({ status }: { status: Job['status'] }) {
  return (
    <Badge variant="outline" className={`gap-1.5 rounded-md text-[11px] font-medium ${VARIANTS[status]}`}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {fr.jobs.status[status]}
    </Badge>
  )
}
