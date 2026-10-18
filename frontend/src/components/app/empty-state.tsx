import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({ icon: Icon, message, action }: { icon: LucideIcon; message: string; action?: ReactNode }) {
  return (
    <div className="grid min-w-0 place-items-center gap-3 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground sm:p-10">
      <Icon className="size-6" aria-hidden />
      <p className="max-w-md break-words">{message}</p>
      {action}
    </div>
  )
}
