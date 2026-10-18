import { Boxes, TriangleAlert } from 'lucide-react'
import type { AppState, UpdateEntry } from '@/api/types'
import { AppLink } from '@/components/app/app-link'
import { MobileField } from '@/components/app/mobile-cards'
import { AppRowActions, AppRowUpdate } from '@/features/apps/AppRowActions'
import { StatusBadge } from '@/features/apps/StatusBadge'
import { fr } from '@/i18n/fr'

function warningLabel(code: string): string {
  return fr.warnings[code as keyof typeof fr.warnings] ?? code
}

/** Compact, status-led SSDv2 card. Desktop continues using its data table. */
export function BrandAppCard({ app, update }: { app: AppState; update?: UpdateEntry }) {
  return (
    <li data-app-status={app.runtime_status} className="ssdv2-app-card">
      <div className="ssdv2-app-card-header flex min-w-0 items-start gap-3 px-4 py-3.5">
        <div className="ssdv2-app-monogram shrink-0" aria-hidden>
          <Boxes className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <AppLink name={app.name} className="break-all text-[15px] font-semibold" />
          {app.description && (
            <p className="mt-0.5 line-clamp-2 break-words text-xs leading-relaxed text-muted-foreground">
              {app.description}
            </p>
          )}
        </div>
        <StatusBadge status={app.runtime_status} />
      </div>
      <dl className="space-y-2 border-t border-border/70 px-4 py-3">
        <MobileField label={fr.apps.columns.domain}>
          {app.url && app.domain ? (
            <a href={app.url} target="_blank" rel="noreferrer" className="break-all text-primary hover:underline">{app.domain}</a>
          ) : fr.common.none}
        </MobileField>
        <MobileField label={fr.apps.columns.containers}>
          <span className="font-mono text-xs tabular-nums">{app.containers}</span>
        </MobileField>
        {app.warnings.length > 0 && (
          <MobileField label={fr.apps.columns.warnings}>
            <span className="inline-flex items-center gap-1 text-warning" title={app.warnings.map(warningLabel).join(', ')}>
              <TriangleAlert className="size-3.5" aria-hidden />
              {app.warnings.length}
            </span>
          </MobileField>
        )}
      </dl>
      {app.installed && (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-border/70 bg-secondary/15 px-4 py-2.5">
          <AppRowActions app={app} />
          <AppRowUpdate app={app} update={update} />
        </div>
      )}
    </li>
  )
}
