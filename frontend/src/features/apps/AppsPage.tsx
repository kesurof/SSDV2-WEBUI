import { useMemo, useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { AppsTable } from '@/features/apps/AppsTable'
import { filterApps } from '@/features/apps/filter'
import type { StatusFilter } from '@/features/apps/filter'
import { useApps } from '@/features/apps/useApps'
import { fr } from '@/i18n/fr'

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: fr.apps.filterAll },
  { value: 'installed', label: fr.apps.filterInstalled },
  { value: 'not_installed', label: fr.apps.filterNotInstalled },
  { value: 'running', label: fr.apps.filterRunning },
  { value: 'stopped', label: fr.apps.filterStopped },
]

export function AppsPage() {
  const apps = useApps()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')

  const filtered = useMemo(
    () => filterApps(apps.data ?? [], search, status),
    [apps.data, search, status],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">
          {fr.apps.title}{' '}
          <span className="text-sm font-normal text-muted-foreground">
            {filtered.length} / {apps.data?.length ?? 0}
          </span>
        </h1>
        <div className="flex items-center gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={fr.apps.search}
            className="w-64"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
            className="h-9 rounded-md border bg-transparent px-2 text-sm"
          >
            {FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {apps.isPending && <p className="text-sm text-muted-foreground">{fr.common.loading}</p>}

      {apps.isError && (
        <Alert variant="destructive">
          <AlertTitle>{fr.common.error}</AlertTitle>
          <AlertDescription>{apps.error.message}</AlertDescription>
        </Alert>
      )}

      {apps.data && <AppsTable apps={filtered} />}
    </div>
  )
}
