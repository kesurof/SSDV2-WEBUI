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
    'flex items-center gap-3.5 rounded-2xl border bg-card p-4 text-left',
    interactive &&
      'transition-colors hover:border-primary/40 hover:bg-secondary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
    active && 'border-primary/60 ring-1 ring-primary/30',
  )
  const content = (
    <>
      <div className={cn('grid size-11 shrink-0 place-items-center rounded-xl', TONE_CLASSES[tone])}>
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <div className="text-2xl leading-none font-bold tracking-tight">{value}</div>
        <div className="mt-1 truncate text-xs text-muted-foreground">{label}</div>
      </div>
    </>
  )

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(className, 'w-full cursor-pointer')}>
        {content}
      </button>
    )
  }
  return <div className={className}>{content}</div>
}
