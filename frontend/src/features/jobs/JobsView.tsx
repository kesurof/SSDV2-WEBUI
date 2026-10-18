import { ListChecks, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/app/empty-state'
import { AppLink } from '@/components/app/app-link'
import { Pagination } from '@/components/app/pagination'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { JobStatusBadge } from '@/features/jobs/JobStatusBadge'
import { usePageSlice } from '@/hooks/usePageSlice'
import { fr } from '@/i18n/fr'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Job } from '@/api/types'

const PAGE_SIZE = 20

type StatusFilter = 'all' | 'running' | 'success' | 'failed'

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: fr.jobs.filters.all },
  { value: 'running', label: fr.jobs.filters.running },
  { value: 'success', label: fr.jobs.filters.success },
  { value: 'failed', label: fr.jobs.filters.failed },
]

export function jobTypeLabel(type: string): string {
  return fr.jobs.types[type as keyof typeof fr.jobs.types] ?? type
}

function matchesStatus(job: Job, filter: StatusFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'running') return job.status === 'queued' || job.status === 'running'
  return job.status === filter
}

export function JobsView({ jobs, selectedId }: { jobs: Job[]; selectedId?: number }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return jobs.filter((job) => {
      if (!matchesStatus(job, filter)) return false
      if (!needle) return true
      return `${job.id} ${job.type} ${job.target} ${job.status} ${jobTypeLabel(job.type)}`
        .toLowerCase()
        .includes(needle)
    })
  }, [jobs, search, filter])

  const { page, setPage, pageCount, pageItems } = usePageSlice(filtered, PAGE_SIZE)

  return (
    <div className="space-y-3">
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
            placeholder={fr.jobs.search}
            className="w-56 pl-8"
            aria-label={fr.jobs.search}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((item) => (
            <Button
              key={item.value}
              size="sm"
              variant={filter === item.value ? 'default' : 'outline'}
              onClick={() => {
                setFilter(item.value)
                setPage(0)
              }}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={ListChecks} message={fr.jobs.empty} />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          {pageItems.map((job) => (
            <div
              key={job.id}
              className={cn(
                'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-l-2 border-l-transparent px-3 py-3 last:border-b-0 hover:bg-secondary/60',
                selectedId === job.id && 'border-l-primary bg-accent/60',
              )}
            >
              <Link to={`/jobs/${job.id}`} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-sm focus-visible:outline-2 focus-visible:outline-ring">
                <span className="font-mono text-xs text-muted-foreground">#{job.id}</span>
                <JobStatusBadge status={job.status} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{jobTypeLabel(job.type)}</span>
              </Link>
              {job.type.startsWith('app_') ? (
                <AppLink name={job.target} className="max-w-full break-all text-sm" />
              ) : (
                <span className="break-all text-sm text-muted-foreground">{job.target}</span>
              )}
              <span className="w-full text-xs text-muted-foreground">{formatDate(job.created_at)}</span>
            </div>
          ))}
        </div>
      )}

      <Pagination
        page={page}
        pageCount={pageCount}
        total={filtered.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </div>
  )
}
