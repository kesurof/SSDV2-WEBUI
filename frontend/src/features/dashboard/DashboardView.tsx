import {
  ArrowUpCircle,
  Boxes,
  CirclePlay,
  CircleStop,
  Cpu,
  Download,
  HardDrive,
  MemoryStick,
  Server,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { MetricCard } from '@/components/app/metric-card'
import { PageHeader } from '@/components/app/page-header'
import { ProgressBar } from '@/components/app/progress-bar'
import { StatusPill } from '@/components/app/status-pill'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { HostMetrics, Job, Notification, SystemSummary } from '@/api/types'
import { JobStatusBadge } from '@/features/jobs/JobStatusBadge'
import { jobTypeLabel } from '@/features/jobs/JobsView'
import { fr } from '@/i18n/fr'
import { formatBytes, formatDate, formatPercent } from '@/lib/format'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  )
}

export function DashboardView({
  summary,
  metrics,
  jobs,
  notifications,
  updatesCount,
}: {
  summary: SystemSummary
  metrics?: HostMetrics
  jobs?: Job[]
  notifications?: Notification[]
  updatesCount?: number
}) {
  const recentJobs = (jobs ?? []).slice(0, 4)
  const alerts = (notifications ?? []).slice(0, 3)

  return (
    <div className="space-y-4">
      <PageHeader
        title={fr.dashboard.title}
        subtitle="Vue d'ensemble de votre instance SSDV2."
        actions={
          <StatusPill tone={summary.status === 'ok' ? 'ok' : 'warn'}>
            {summary.status === 'ok' ? fr.health.operational : fr.health.degraded}
          </StatusPill>
        }
      />

      {summary.warnings.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>{fr.apps.alerts}</AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc">
              {summary.warnings.map((warning) => (
                <li key={warning}>{fr.warnings[warning as keyof typeof fr.warnings] ?? warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Cpu className="size-4 text-muted-foreground" aria-hidden />
              Santé du serveur
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Cpu className="size-3.5" aria-hidden />
                  {fr.health.cpu}
                </span>
                <span className="font-semibold">{formatPercent(metrics?.cpu_percent)}</span>
              </div>
              <ProgressBar value={metrics?.cpu_percent ?? 0} />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <MemoryStick className="size-3.5" aria-hidden />
                  {fr.health.memory}
                </span>
                <span className="font-semibold">
                  {metrics?.memory.total_bytes
                    ? `${formatBytes(metrics.memory.used_bytes)} / ${formatBytes(metrics.memory.total_bytes)}`
                    : '—'}
                </span>
              </div>
              <ProgressBar value={metrics?.memory.percent ?? 0} tone="ok" />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <HardDrive className="size-3.5" aria-hidden />
                  {fr.health.storage}
                </span>
                <span className="font-semibold">
                  {metrics?.disk.total_bytes
                    ? `${formatBytes(metrics.disk.used_bytes)} / ${formatBytes(metrics.disk.total_bytes)}`
                    : '—'}
                </span>
              </div>
              <ProgressBar value={metrics?.disk.percent ?? 0} tone="warn" />
            </div>
            <Link to="/health" className="inline-block text-sm font-medium text-primary hover:underline">
              Vue complète
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Server className="size-4 text-muted-foreground" aria-hidden />
              {fr.dashboard.ssdv2}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Field label={fr.dashboard.hostname}>{summary.host.hostname ?? '—'}</Field>
            <Field label={fr.dashboard.os}>{summary.host.os ?? '—'}</Field>
            <Field label={fr.dashboard.kernel}>{summary.host.kernel ?? '—'}</Field>
            <Field label={fr.dashboard.architecture}>{summary.host.architecture ?? '—'}</Field>
            <Field label={fr.dashboard.dockerVersion}>
              {summary.host.server_version ?? '—'}
            </Field>
            <Field label={fr.dashboard.branch}>{summary.ssdv2.branch ?? '—'}</Field>
            <Field label={fr.dashboard.commit}>
              <span className="font-mono text-xs">
                {summary.ssdv2.commit ? summary.ssdv2.commit.slice(0, 10) : '—'}
              </span>
            </Field>
            <Field label={fr.dashboard.memory}>{formatBytes(summary.host.memory_bytes)}</Field>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Boxes}
          value={summary.ssdv2.apps_total}
          label={fr.dashboard.appsTotal}
          to="/apps"
        />
        <MetricCard
          icon={Download}
          value={summary.ssdv2.installed}
          label={fr.dashboard.installed}
          tone="ok"
          to="/apps?status=installed"
        />
        <MetricCard
          icon={CirclePlay}
          value={summary.ssdv2.running}
          label={fr.dashboard.running}
          tone="ok"
          to="/apps?status=running"
        />
        <MetricCard
          icon={CircleStop}
          value={summary.ssdv2.stopped}
          label={fr.dashboard.stopped}
          tone={summary.ssdv2.stopped > 0 ? 'err' : 'info'}
          to="/apps?status=stopped"
        />
      </div>

      {updatesCount !== undefined && updatesCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-warning-soft text-warning">
            <ArrowUpCircle className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="font-semibold">
              {fr.updates.countAvailable.replace('{count}', String(updatesCount))}
            </div>
            <div className="text-xs text-muted-foreground">{fr.updates.subtitle}</div>
          </div>
          <span className="flex-1" />
          <Button variant="outline" size="sm" nativeButton={false} render={<Link to="/updates" />}>
            {fr.updates.title}
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Jobs récents</CardTitle>
            <CardAction>
              <Button variant="ghost" size="sm" nativeButton={false} render={<Link to="/jobs" />}>
                {fr.common.seeAll}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">{fr.jobs.empty}</p>
            ) : (
              recentJobs.map((job) => (
                <Link
                  key={job.id}
                  to={`/jobs/${job.id}`}
                  className="flex items-center gap-3 rounded-xl border px-3 py-2.5 hover:bg-secondary/60"
                >
                  <JobStatusBadge status={job.status} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {jobTypeLabel(job.type)} → {job.target}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDate(job.created_at)}
                    </span>
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Alertes actives</CardTitle>
            <CardAction>
              <Button variant="ghost" size="sm" nativeButton={false} render={<Link to="/notifications" />}>
                {fr.common.seeAll}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{fr.notifications.empty}</p>
            ) : (
              alerts.map((notification) => (
                <div
                  key={notification.id}
                  className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
                >
                  <StatusPill tone={notification.severity === 'error' ? 'err' : 'ok'}>
                    {notification.severity === 'error' ? 'Erreur' : 'Succès'}
                  </StatusPill>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{notification.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDate(notification.created_at)}
                    </span>
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
