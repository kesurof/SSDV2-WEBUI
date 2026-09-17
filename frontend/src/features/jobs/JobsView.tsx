import { Link } from 'react-router-dom'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { JobStatusBadge } from '@/features/jobs/JobStatusBadge'
import { fr } from '@/i18n/fr'
import type { Job } from '@/api/types'

function formatDate(value: string): string {
  const iso = value.endsWith('Z') || value.includes('+') ? value : `${value}Z`
  return new Date(iso).toLocaleString('fr-FR')
}

export function jobTypeLabel(type: string): string {
  return fr.jobs.types[type as keyof typeof fr.jobs.types] ?? type
}

export function JobsView({ jobs }: { jobs: Job[] }) {
  if (jobs.length === 0) {
    return <p className="text-sm text-muted-foreground">{fr.jobs.empty}</p>
  }
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{fr.jobs.columns.id}</TableHead>
            <TableHead>{fr.jobs.columns.type}</TableHead>
            <TableHead>{fr.jobs.columns.target}</TableHead>
            <TableHead>{fr.jobs.columns.status}</TableHead>
            <TableHead>{fr.jobs.columns.created}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow key={job.id}>
              <TableCell>
                <Link to={`/jobs/${job.id}`} className="font-medium hover:underline">
                  #{job.id}
                </Link>
              </TableCell>
              <TableCell>{jobTypeLabel(job.type)}</TableCell>
              <TableCell>{job.target}</TableCell>
              <TableCell>
                <JobStatusBadge status={job.status} />
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {formatDate(job.created_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
