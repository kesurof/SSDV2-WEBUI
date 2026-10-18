import { fr } from '@/i18n/fr'

export function PageSkeleton() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse space-y-6 motion-reduce:animate-none">
      <span className="sr-only">{fr.common.loading}</span>
      <div className="space-y-2">
        <div className="h-6 w-56 max-w-full rounded-md bg-secondary" />
        <div className="h-4 w-80 max-w-full rounded-md bg-secondary/70" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="ssdv2-module-panel h-24 rounded-2xl border bg-card/60" />
        ))}
      </div>
      <div className="ssdv2-module-panel space-y-3 rounded-2xl border bg-card/60 p-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-5 rounded-md bg-secondary/70" />
        ))}
      </div>
    </div>
  )
}
