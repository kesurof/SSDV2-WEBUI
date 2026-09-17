import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type StatusTone = 'ok' | 'warn' | 'err' | 'info' | 'muted'

const TONE_CLASSES: Record<StatusTone, string> = {
  ok: 'bg-success-soft text-success',
  warn: 'bg-warning-soft text-warning',
  err: 'bg-destructive-soft text-destructive',
  info: 'bg-accent text-accent-foreground',
  muted: 'bg-secondary text-muted-foreground',
}

export function StatusPill({
  tone = 'muted',
  children,
  className,
}: {
  tone?: StatusTone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        TONE_CLASSES[tone],
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  )
}
