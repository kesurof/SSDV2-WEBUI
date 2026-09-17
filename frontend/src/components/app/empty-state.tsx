import type { LucideIcon } from 'lucide-react'

export function EmptyState({ icon: Icon, message }: { icon: LucideIcon; message: string }) {
  return (
    <div className="grid place-items-center gap-2 p-10 text-center text-sm text-muted-foreground">
      <Icon className="size-6" aria-hidden />
      <p>{message}</p>
    </div>
  )
}
