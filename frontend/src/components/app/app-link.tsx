import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

/** Navigation interne vers une fiche d'application SSDv2, jamais son URL publique. */
export function AppLink({ name, className }: { name: string; className?: string }) {
  return (
    <Link
      to={`/apps/${encodeURIComponent(name)}`}
      className={cn('font-medium text-foreground hover:text-primary hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring', className)}
    >
      {name}
    </Link>
  )
}
