import type { ReactNode } from 'react'

/** Listes compactes uniquement sur mobile. Les tableaux desktop restent disponibles. */
export function MobileCards({ label, children }: { label: string; children: ReactNode }) {
  return <ul aria-label={label} className="grid gap-3 lg:hidden">{children}</ul>
}

export function MobileCard({ children }: { children: ReactNode }) {
  return <li className="min-w-0 rounded-xl border bg-card p-4 shadow-sm">{children}</li>
}

export function MobileField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 text-xs">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right text-foreground">{children}</dd>
    </div>
  )
}
