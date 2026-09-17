import { Boxes, CirclePlay, CircleStop, Download, Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { MetricCard } from '@/components/app/metric-card'
import { PageHeader } from '@/components/app/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AppsTable } from '@/features/apps/AppsTable'
import { filterApps } from '@/features/apps/filter'
import type { StatusFilter } from '@/features/apps/filter'
import { useApps } from '@/features/system/useSystem'
import { fr } from '@/i18n/fr'

const PAGE_SIZE = 20

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: fr.apps.filterAll },
  { value: 'installed', label: fr.apps.filterInstalled },
  { value: 'running', label: fr.apps.filterRunning },
  { value: 'stopped', label: fr.apps.filterStopped },
  { value: 'not_installed', label: fr.apps.filterNotInstalled },
]

export function AppsPage() {
  const apps = useApps()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [page, setPage] = useState(0)

  const filtered = useMemo(
    () => filterApps(apps.data ?? [], search, status),
    [apps.data, search, status],
  )

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

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const pageItems = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE)

  function changeFilter(value: StatusFilter) {
    setStatus(value)
    setPage(0)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={fr.apps.title}
        subtitle="Gérez vos applications Docker et leurs configurations."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Boxes} value={counts.all} label={fr.dashboard.appsTotal} />
        <MetricCard icon={Download} value={counts.installed} label={fr.dashboard.installed} tone="ok" />
        <MetricCard icon={CirclePlay} value={counts.running} label={fr.dashboard.running} tone="ok" />
        <MetricCard
          icon={CircleStop}
          value={counts.stopped}
          label={fr.dashboard.stopped}
          tone={counts.stopped > 0 ? 'err' : 'info'}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(0)
            }}
            placeholder={fr.apps.search}
            className="w-64 pl-8"
            aria-label={fr.apps.search}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((filter) => (
            <Button
              key={filter.value}
              size="sm"
              variant={status === filter.value ? 'default' : 'outline'}
              onClick={() => changeFilter(filter.value)}
            >
              {filter.label} {counts[filter.value]}
            </Button>
          ))}
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
          <AppsTable apps={pageItems} />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {filtered.length === 0
                ? '0'
                : `${currentPage * PAGE_SIZE + 1}–${Math.min(filtered.length, (currentPage + 1) * PAGE_SIZE)}`}{' '}
              / {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage === 0}
                onClick={() => setPage((value) => Math.max(0, value - 1))}
              >
                {fr.common.previous}
              </Button>
              <span>
                {currentPage + 1} / {pageCount}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage >= pageCount - 1}
                onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
              >
                {fr.common.next}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
