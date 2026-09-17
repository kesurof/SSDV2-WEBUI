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
      <h1 className="text-lg font-semibold">{fr.authApps.title}</h1>
      <p className="text-xs text-muted-foreground">{fr.authApps.hint}</p>

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

      <div className="rounded-md border">
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
                <TableCell className="font-medium">{app.name}</TableCell>
                <TableCell>{authByApp[app.name] ?? '—'}</TableCell>
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
