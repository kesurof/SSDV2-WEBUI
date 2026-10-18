import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({ icon: Icon, message, action, illustrated = false }: { icon: LucideIcon; message: string; action?: ReactNode; illustrated?: boolean }) {
  return (
    <div className="ssdv2-illustrated-empty grid min-w-0 place-items-center gap-3 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground sm:p-10">
      {illustrated && (
        <img src="/branding/illustrations/empty-state.svg" alt="" aria-hidden="true" loading="lazy" />
      )}
      <div className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">
        <Icon className="size-5" aria-hidden />
      </div>
      <p className="max-w-md break-words">{message}</p>
      {action}
    </div>
  )
}
