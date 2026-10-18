import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { PageHeader } from '@/components/app/page-header'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/app/pagination'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { AppsTable } from '@/features/apps/AppsTable'
import { filterApps } from '@/features/apps/filter'
import type { StatusFilter } from '@/features/apps/filter'
import { useApps, useUpdates } from '@/features/system/useSystem'
import { usePageSlice } from '@/hooks/usePageSlice'
import { fr } from '@/i18n/fr'

const PAGE_SIZE = 20

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: fr.apps.filterAll },
  { value: 'installed', label: fr.apps.filterInstalled },
  { value: 'running', label: fr.apps.filterRunning },
  { value: 'stopped', label: fr.apps.filterStopped },
  { value: 'not_installed', label: fr.apps.filterNotInstalled },
]

function isStatusFilter(value: string | null): value is StatusFilter {
  return FILTERS.some((filter) => filter.value === value)
}

export function AppsPage() {
  const apps = useApps()
  const updates = useUpdates()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialStatus = searchParams.get('status')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>(
    isStatusFilter(initialStatus) ? initialStatus : 'all',
  )

  const filtered = useMemo(
    () => filterApps(apps.data ?? [], search, status),
    [apps.data, search, status],
  )

  const { page: currentPage, setPage, pageCount, pageItems } = usePageSlice(filtered, PAGE_SIZE)

  const counts = useMemo(() => {
    const all = apps.data ?? []
    return {
      all: all.length,
      installed: all.filter((app) => app.installed).length,
      running: all.filter((app) => app.runtime_status === 'running').length,
      stopped: all.filter((app) => app.runtime_status === 'stopped').length,
      not_installed: all.filter((app) => app.runtime_status === 'not_installed').length,
    }
  }, [apps.data])

  function changeFilter(value: StatusFilter) {
    setStatus(value)
    setPage(0)
    setSearchParams(value === 'all' ? {} : { status: value }, { replace: true })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={fr.apps.title}
        subtitle="Gérez vos applications Docker et leurs configurations."
      />

      <div className="ssdv2-module-panel px-3 pt-2 sm:px-4">
        <div className="flex min-w-0 flex-col-reverse gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div role="group" aria-label="Filtrer les applications" className="flex w-full min-w-0 max-w-full items-end gap-1 overflow-x-auto whitespace-nowrap pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:w-auto">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                aria-pressed={status === filter.value}
                className="control-tab-button shrink-0"
                onClick={() => changeFilter(filter.value)}
              >
                {filter.label}
                <span className="control-tab-count">{counts[filter.value]}</span>
              </button>
            ))}
          </div>
          <div className="relative mb-1 min-w-0 sm:mb-2 sm:shrink-0">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(0)
              }}
              placeholder={fr.apps.search}
              className="h-10 w-full pl-8 sm:h-9 sm:w-64"
              aria-label={fr.apps.search}
            />
          </div>
        </div>
      </div>

      {apps.isPending && <p className="text-sm text-muted-foreground">{fr.common.loading}</p>}

      {apps.isError && (
        <Alert variant="destructive">
          <AlertTitle>{fr.common.error}</AlertTitle>
          <AlertDescription>{apps.error.message}</AlertDescription>
        </Alert>
      )}

      {apps.data && (
        <>
          {filtered.length === 0 && apps.data.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => {
              setSearch('')
              changeFilter('all')
            }}>Réinitialiser les filtres</Button>
          )}
          <AppsTable
            apps={pageItems}
            updatesByApp={Object.fromEntries(
              (updates.data?.entries ?? []).map((entry) => [entry.app, entry]),
            )}
          />
          <Pagination
            page={currentPage}
            pageCount={pageCount}
            total={filtered.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  )
}
