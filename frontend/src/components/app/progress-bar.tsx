import { cn } from '@/lib/utils'

const TONE_CLASSES = {
  info: 'bg-primary',
  ok: 'bg-success',
  warn: 'bg-warning',
  err: 'bg-destructive',
} as const

export function ProgressBar({
  value,
  tone = 'info',
  className,
}: {
  value: number
  tone?: keyof typeof TONE_CLASSES
  className?: string
}) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div
      className={cn('h-2 overflow-hidden rounded-full bg-secondary', className)}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span className={cn('block h-full rounded-full', TONE_CLASSES[tone])} style={{ width: `${clamped}%` }} />
    </div>
  )
}
