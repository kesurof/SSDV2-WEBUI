import { Badge } from '@/components/ui/badge'
import { fr } from '@/i18n/fr'
import type { AppState } from '@/api/types'

const VARIANTS: Record<AppState['runtime_status'], string> = {
  running: 'border-transparent bg-emerald-600 text-white',
  partial: 'border-transparent bg-amber-500 text-white',
  stopped: 'text-muted-foreground',
  unknown: 'border-transparent bg-amber-100 text-amber-900',
  not_installed: 'text-muted-foreground',
}

export function StatusBadge({ status }: { status: AppState['runtime_status'] }) {
  return (
    <Badge variant="outline" className={VARIANTS[status]}>
      {fr.status[status]}
    </Badge>
  )
}
