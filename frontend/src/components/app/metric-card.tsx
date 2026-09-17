import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

const TONE_CLASSES = {
  info: 'bg-accent text-accent-foreground',
  ok: 'bg-success-soft text-success',
  warn: 'bg-warning-soft text-warning',
  err: 'bg-destructive-soft text-destructive',
} as const

export function MetricCard({
  icon: Icon,
  value,
  label,
  tone = 'info',
}: {
  icon: LucideIcon
  value: ReactNode
  label: string
  tone?: keyof typeof TONE_CLASSES
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border bg-card p-4">
      <div className={cn('grid size-11 shrink-0 place-items-center rounded-xl', TONE_CLASSES[tone])}>
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <div className="text-2xl leading-none font-bold tracking-tight">{value}</div>
        <div className="mt-1 truncate text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  )
}
