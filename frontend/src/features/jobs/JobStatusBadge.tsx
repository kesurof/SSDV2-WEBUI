import { Badge } from '@/components/ui/badge'
import { fr } from '@/i18n/fr'
import type { Job } from '@/api/types'

const VARIANTS: Record<Job['status'], string> = {
  queued: 'text-muted-foreground',
  running: 'border-transparent bg-sky-600 text-white',
  success: 'border-transparent bg-emerald-600 text-white',
  failed: 'border-transparent bg-red-600 text-white',
  cancelled: 'text-muted-foreground',
  interrupted: 'border-transparent bg-amber-500 text-white',
}

export function JobStatusBadge({ status }: { status: Job['status'] }) {
  return (
    <Badge variant="outline" className={VARIANTS[status]}>
      {fr.jobs.status[status]}
    </Badge>
  )
}
