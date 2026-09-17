import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table'
import { TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/features/apps/StatusBadge'
import { fr } from '@/i18n/fr'
import type { AppState } from '@/api/types'

const features = tableFeatures({})
const columnHelper = createColumnHelper<typeof features, AppState>()

function warningLabel(code: string): string {
  return fr.warnings[code as keyof typeof fr.warnings] ?? code
}

const columns = columnHelper.columns([
  columnHelper.accessor('name', {
    header: fr.apps.columns.name,
    cell: (ctx) => (
      <div>
        <Link to={`/apps/${ctx.getValue()}`} className="font-medium hover:underline">
          {ctx.getValue()}
        </Link>
        <div className="max-w-md truncate text-xs text-muted-foreground">
          {ctx.row.original.description}
        </div>
      </div>
    ),
  }),
  columnHelper.accessor('runtime_status', {
    header: fr.apps.columns.status,
    cell: (ctx) => <StatusBadge status={ctx.getValue()} />,
  }),
  columnHelper.accessor((row) => row.url ?? '—', {
    id: 'url',
    header: fr.apps.columns.url,
    cell: (ctx) => <span className="text-sm">{ctx.getValue()}</span>,
  }),
  columnHelper.accessor((row) => row.image ?? '—', {
    id: 'image',
    header: fr.apps.columns.image,
    cell: (ctx) => <span className="font-mono text-xs">{ctx.getValue()}</span>,
  }),
  columnHelper.accessor('containers', {
    header: fr.apps.columns.containers,
    cell: (ctx) => <span className="text-sm">{ctx.getValue()}</span>,
  }),
  columnHelper.accessor('warnings', {
    header: fr.apps.columns.warnings,
    cell: (ctx) => {
      const warnings = ctx.getValue()
      if (warnings.length === 0) {
        return <span className="text-muted-foreground">—</span>
      }
      return (
        <span
          className="inline-flex items-center gap-1 text-amber-600"
          title={warnings.map(warningLabel).join(', ')}
        >
          <TriangleAlert className="size-4" />
          {warnings.length}
        </span>
      )
    },
  }),
])

export function AppsTable({ apps }: { apps: AppState[] }) {
  const table = useTable({ features, columns, data: apps })

  if (apps.length === 0) {
    return <p className="text-sm text-muted-foreground">{fr.apps.empty}</p>
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getAllCells().map((cell) => (
                <TableCell key={cell.id}>
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
