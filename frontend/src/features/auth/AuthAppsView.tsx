import { useState } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { AppLink } from '@/components/app/app-link'
import { BrandPanel, BrandSectionHeading } from '@/components/app/brand-panel'
import { ShieldCheck, Shield } from 'lucide-react'
import { MobileCards, MobileCard, MobileField } from '@/components/app/mobile-cards'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AUTH_TYPES } from '@/features/auth/authTypes'
import type { AuthType } from '@/features/auth/authTypes'
import { fr } from '@/i18n/fr'
import type { AppState } from '@/api/types'

export function AuthAppsView({
  apps,
  authByApp,
  selected,
  auth,
  busy,
  onToggle,
  onToggleAll,
  onAuthChange,
  onApply,
}: {
  apps: AppState[]
  authByApp: Record<string, string | null>
  selected: string[]
  auth: AuthType
  busy: boolean
  onToggle: (app: string) => void
  onToggleAll: () => void
  onAuthChange: (auth: AuthType) => void
  onApply: () => void
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const allSelected = apps.length > 0 && selected.length === apps.length

  return (
    <div className="space-y-4">
      <div className="ssdv2-eyebrow"><span className="ssdv2-triad" aria-hidden /> SSDv2 / sécurité</div>
      <h1 className="text-xl font-bold tracking-tight">{fr.authApps.title}</h1>
      <p className="text-xs text-muted-foreground">{fr.authApps.hint}</p>

      <BrandPanel as="div" className="flex min-w-0 flex-wrap items-center gap-3 p-4">
        <div className="ssdv2-resource-icon"><ShieldCheck className="size-5" aria-hidden /></div>
        <div className="min-w-0 flex-1">
          <div className="ssdv2-eyebrow">Applications protégées</div>
          <div className="mt-1 text-xs text-muted-foreground">Selon les protections déclarées par SSDv2</div>
        </div>
        <div className="ssdv2-metric-value font-mono text-2xl font-semibold tabular-nums">
          {apps.filter((app) => {
            const mode = authByApp[app.name]
            return mode && mode !== 'aucune'
          }).length} <span className="text-sm text-muted-foreground">/ {apps.length}</span>
        </div>
      </BrandPanel>

      <BrandPanel as="div" className="space-y-3 p-4">
      <BrandSectionHeading>Modification groupée</BrandSectionHeading>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="bulk-auth">{fr.authApps.target}</Label>
          <select
            id="bulk-auth"
            value={auth}
            onChange={(event) => onAuthChange(event.target.value as AuthType)}
            className="h-9 rounded-md border bg-transparent px-2 text-sm"
          >
            {AUTH_TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <Button
          size="sm"
          disabled={selected.length === 0 || busy}
          onClick={() => setConfirmOpen(true)}
        >
          {fr.authApps.apply} ({selected.length})
        </Button>
      </div>

      </BrandPanel>
      <BrandSectionHeading>Applications et protections</BrandSectionHeading>
      <div className="flex items-center gap-2 lg:hidden">
        <input
          type="checkbox"
          aria-label={`${fr.authApps.selectAll} (mobile)`}
          checked={allSelected}
          onChange={onToggleAll}
        />
        <span className="text-xs text-muted-foreground">{fr.authApps.selectAll}</span>
      </div>
      <MobileCards label="Authentification des applications (vue mobile)">
        {apps.map((app) => (
          <MobileCard key={app.name}>
            <div className="flex min-w-0 items-center gap-3">
              <div className="ssdv2-resource-icon"><Shield className="size-4" aria-hidden /></div>
              <input
                type="checkbox"
                aria-label={`${app.name} (mobile)`}
                checked={selected.includes(app.name)}
                onChange={() => onToggle(app.name)}
              />
              <AppLink name={app.name} className="min-w-0 break-all text-base font-semibold" />
            </div>
            <dl className="mt-3 space-y-2 border-t pt-3">
              <MobileField label={fr.apps.fields.auth}>{authByApp[app.name] ?? '—'}</MobileField>
              <MobileField label={fr.apps.columns.domain}>
                {app.domain && app.url
                  ? <a href={app.url} target="_blank" rel="noreferrer" className="break-all text-primary hover:underline">{app.domain}</a>
                  : '—'}
              </MobileField>
            </dl>
          </MobileCard>
        ))}
      </MobileCards>
      <div className="ssdv2-module-panel hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label={fr.authApps.selectAll}
                  checked={allSelected}
                  onChange={onToggleAll}
                />
              </TableHead>
              <TableHead>{fr.apps.columns.name}</TableHead>
              <TableHead>{fr.apps.fields.auth}</TableHead>
              <TableHead>{fr.apps.columns.domain}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apps.map((app) => (
              <TableRow key={app.name}>
                <TableCell>
                  <input
                    type="checkbox"
                    aria-label={app.name}
                    checked={selected.includes(app.name)}
                    onChange={() => onToggle(app.name)}
                  />
                </TableCell>
                <TableCell><AppLink name={app.name} /></TableCell>
                <TableCell>{authByApp[app.name] ?? '—'}</TableCell>
                <TableCell>
                  {app.domain && app.url ? (
                    <a
                      href={app.url}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                    >
                      {app.domain}
                    </a>
                  ) : (
                    '—'
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{fr.actions.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {fr.authApps.confirm
                .replace('{count}', String(selected.length))
                .replace('{auth}', auth)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{fr.actions.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false)
                onApply()
              }}
            >
              {fr.actions.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
