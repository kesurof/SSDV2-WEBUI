import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Decorative frame with semantic status encoded by text in the child badge. */
export function BrandStatusRail({
  tone,
  status,
  children,
  className,
}: {
  tone: 'ok' | 'warn' | 'err' | 'info' | 'muted'
  status?: string
  children: ReactNode
  className?: string
}) {
  return <div data-rail-tone={tone} data-job-status={status} className={cn('ssdv2-status-rail min-w-0', className)}>{children}</div>
}
