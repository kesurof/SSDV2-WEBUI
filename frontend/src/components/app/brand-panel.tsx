import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Surface modulaire SSDv2. Les états métier restent représentés séparément. */
export function BrandPanel({
  children,
  className,
  as: Tag = 'section',
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'div' | 'article'
}) {
  return <Tag className={cn('ssdv2-module-panel', className)}>{children}</Tag>
}

export function BrandSectionHeading({
  children,
  aside,
  className,
}: {
  children: ReactNode
  aside?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('ssdv2-section-heading flex min-w-0 items-center justify-between gap-3', className)}>
      <h2 className="min-w-0 text-sm font-semibold tracking-tight sm:text-base">{children}</h2>
      {aside}
    </div>
  )
}
