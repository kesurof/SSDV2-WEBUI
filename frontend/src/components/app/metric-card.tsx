import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

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
  to,
  onClick,
  active = false,
}: {
  icon: LucideIcon
  value: ReactNode
  label: string
  tone?: keyof typeof TONE_CLASSES
  to?: string
  onClick?: () => void
  active?: boolean
}) {
  const interactive = Boolean(to || onClick)
  const className = cn(
    'ssdv2-metric-card flex min-w-0 flex-col items-start gap-2 rounded-xl border p-3.5 text-left sm:flex-row sm:items-center sm:gap-3 sm:p-4',
    interactive &&
      'transition-colors hover:border-primary/40 hover:bg-secondary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
    active && 'border-primary/60 ring-1 ring-primary/30',
  )
  const content = (
    <>
      <div className={cn('grid size-8 shrink-0 place-items-center rounded-lg sm:size-9', TONE_CLASSES[tone])}>
        <Icon className="size-4.5" aria-hidden />
      </div>
      <div className="min-w-0">
        <div className="ssdv2-metric-value font-mono text-2xl leading-none font-semibold sm:text-[1.7rem]">{value}</div>
        <div className="mt-1 truncate text-xs text-muted-foreground">{label}</div>
      </div>
    </>
  )

  if (to) {
    return (
      <Link to={to} data-tone={tone} className={className}>
        {content}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" data-tone={tone} onClick={onClick} className={cn(className, 'w-full cursor-pointer')}>
        {content}
      </button>
    )
  }
  return <div data-tone={tone} className={className}>{content}</div>
}
