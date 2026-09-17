import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function KeyValueList({
  items,
  className,
}: {
  items: Array<{ label: string; value: ReactNode }>
  className?: string
}) {
  return (
    <dl className={cn('text-sm', className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-start justify-between gap-4 border-b py-2.5 last:border-b-0"
        >
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="min-w-0 text-right font-medium break-all">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
