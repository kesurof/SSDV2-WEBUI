import {
  Activity,
  AlertTriangle,
  ArrowUpCircle,
  Cpu,
  DatabaseBackup,
  HardDrive,
  HeartPulse,
  ListChecks,
  MemoryStick,
  RefreshCw,
  Server,
  ShieldCheck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { EmptyState } from '@/components/app/empty-state'
import { PageHeader } from '@/components/app/page-header'
import { ProgressBar } from '@/components/app/progress-bar'
import { StatusPill } from '@/components/app/status-pill'
import type { StatusTone } from '@/components/app/status-pill'
import { Button } from '@/components/ui/button'
import type { HostMetrics, SystemHealth } from '@/api/types'
import { fr } from '@/i18n/fr'
import { formatBytes, formatDate, formatPercent } from '@/lib/format'

const SERVICE_LABELS: Record<string, string> = {
  docker: fr.health.service.docker,
  ssdv2: fr.health.service.ssdv2,
  database: fr.health.service.database,
  ssdv2ctl: fr.health.service.ssdv2ctl,
  backups: fr.health.service.backups,
  jobs: fr.health.service.jobs,
}

function serviceTone(status: string): StatusTone {
  if (status === 'ok') return 'ok'
  if (status === 'degraded') return 'err'
  return 'muted'
}

function Tile({
  icon: Icon,
  title,
  value,
  hint,
  percent,
  tone = 'info',
}: {
  icon: LucideIcon
  title: string
  value: string
  hint?: string
  percent?: number | null
  tone?: 'info' | 'ok' | 'warn' | 'err'
}) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
          {title}
        </span>
      </div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
      {percent !== undefined && percent !== null ? (
        <ProgressBar className="mt-4" value={percent} tone={tone} />
      ) : null}
    </div>
  )
}

function InfoCard({
  title,
  tone,
  children,
}: {
  title: string
  tone: StatusTone
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{title}</span>
        <StatusPill tone={tone}>{tone === 'ok' ? 'OK' : tone === 'err' ? fr.health.degraded : '—'}</StatusPill>
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">{children}</div>
    </div>
  )
}

export function HealthView({
  health,
  metrics,
  updatesCount,
  onRefresh,
}: {
  health?: SystemHealth
  metrics?: HostMetrics
  updatesCount?: number
  onRefresh: () => void
}) {
  if (!health) {
    return (
      <EmptyState icon={HeartPulse} message={fr.common.loading} />
    )
  }

  const globalTone: StatusTone = health.status === 'ok' ? 'ok' : 'warn'
  const containers = metrics?.containers
  const tlsTone: StatusTone = health.tls.status === 'ok' ? 'ok' : health.tls.status === 'warning' ? 'warn' : 'muted'
  const dnsTone: StatusTone = health.dns.status === 'ok' ? 'ok' : health.dns.status === 'failed' ? 'err' : 'muted'
  const backupsTone: StatusTone = health.backups.status === 'ok' ? 'ok' : 'muted'
  const jobsTone: StatusTone = health.jobs.failed_recent > 0 ? 'warn' : 'ok'
  const alertsTone: StatusTone = health.alerts.unread > 0 ? 'warn' : 'ok'
  const updatesTone: StatusTone = updatesCount && updatesCount > 0 ? 'warn' : 'ok'

  return (
    <div>
      <PageHeader
        title={fr.health.title}
        subtitle={fr.health.subtitle}
        actions={
          <>
            <span className="text-xs text-muted-foreground">
              {fr.health.lastUpdate} : {formatDate(health.checked_at)}
            </span>
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="size-3.5" aria-hidden />
              {fr.common.refresh}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          icon={HeartPulse}
          title={fr.health.global}
          value={health.status === 'ok' ? fr.health.operational : fr.health.degraded}
          hint={health.status === 'ok' ? fr.health.healthyHint : fr.health.degradedHint}
          tone={globalTone === 'ok' ? 'ok' : 'warn'}
        />
        <Tile
          icon={Cpu}
          title={fr.health.cpu}
          value={formatPercent(metrics?.cpu_percent)}
          hint={metrics?.cpu_count ? `${metrics.cpu_count} ${fr.health.cores}` : undefined}
          percent={metrics?.cpu_percent}
        />
        <Tile
          icon={MemoryStick}
          title={fr.health.memory}
          value={formatPercent(metrics?.memory.percent)}
          hint={
            metrics?.memory.total_bytes
              ? `${formatBytes(metrics.memory.used_bytes)} / ${formatBytes(metrics.memory.total_bytes)}`
              : undefined
          }
          percent={metrics?.memory.percent}
          tone="ok"
        />
        <Tile
          icon={HardDrive}
          title={fr.health.storage}
          value={formatPercent(metrics?.disk.percent)}
          hint={
            metrics?.disk.total_bytes
              ? `${formatBytes(metrics.disk.used_bytes)} / ${formatBytes(metrics.disk.total_bytes)}`
              : undefined
          }
          percent={metrics?.disk.percent}
          tone="warn"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard title={fr.health.dockerEngine} tone={serviceTone(health.services.find((s) => s.key === 'docker')?.status ?? 'unknown')}>
          <div>{metrics?.cpu_count ? `${metrics.cpu_count} ${fr.health.cores}` : '—'}</div>
        </InfoCard>
        <InfoCard title={fr.health.containers} tone={containers && containers.unhealthy > 0 ? 'warn' : 'ok'}>
          <div className="text-success">{fr.health.containersHealthy.replace('{count}', String(containers?.running ?? 0))}</div>
          {containers && containers.unhealthy > 0 ? (
            <div className="text-destructive">
              {fr.health.containersUnhealthy.replace('{count}', String(containers.unhealthy))}
            </div>
          ) : null}
          <div>{fr.health.containersStopped.replace('{count}', String(containers?.stopped ?? 0))}</div>
        </InfoCard>
        <InfoCard title={fr.health.tls} tone={tlsTone}>
          <div>
            {health.tls.status === 'ok'
              ? fr.health.tlsValid
              : health.tls.status === 'warning' && health.tls.days_remaining !== null
                ? fr.health.tlsExpires.replace('{days}', String(health.tls.days_remaining))
                : fr.health.tlsUnknown}
          </div>
          {health.tls.hostname ? <div>{health.tls.hostname}</div> : null}
        </InfoCard>
        <InfoCard title={fr.health.dns} tone={dnsTone}>
          <div>
            {health.dns.status === 'ok'
              ? fr.health.dnsResolved
              : health.dns.status === 'failed'
                ? fr.health.dnsFailed
                : fr.health.tlsUnknown}
          </div>
          {health.dns.hostname ? <div>{health.dns.hostname}</div> : null}
        </InfoCard>
        <InfoCard title={fr.health.backups} tone={backupsTone}>
          <div>
            {health.backups.last_at
              ? fr.health.backupsLast.replace('{when}', formatDate(health.backups.last_at))
              : fr.health.alertsNone}
          </div>
          <div>{health.backups.count}</div>
        </InfoCard>
        <InfoCard title={fr.health.jobs} tone={jobsTone}>
          <div>{fr.health.jobsActive.replace('{count}', String(health.jobs.active))}</div>
          {health.jobs.failed_recent > 0 ? (
            <div className="text-warning">{health.jobs.failed_recent} échec(s) sur 24 h</div>
          ) : null}
        </InfoCard>
        <InfoCard title={fr.health.alerts} tone={alertsTone}>
          <div>
            {health.alerts.unread > 0
              ? fr.health.alertsAttention.replace('{count}', String(health.alerts.unread))
              : fr.health.alertsNone}
          </div>
        </InfoCard>
        <InfoCard title={fr.health.updates} tone={updatesTone}>
          <div className="flex items-center gap-2">
            {updatesCount && updatesCount > 0 ? (
              <>
                <ArrowUpCircle className="size-4 text-warning" aria-hidden />
                {fr.health.updatesAvailable.replace('{count}', String(updatesCount))}
              </>
            ) : (
              <>
                <ShieldCheck className="size-4 text-success" aria-hidden />
                {fr.health.updatesNone}
              </>
            )}
          </div>
        </InfoCard>
      </div>

      <div className="mt-4 rounded-2xl border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold">{fr.health.services}</h2>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {health.services.map((service) => (
            <div
              key={service.key}
              className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm"
            >
              <span className="flex items-center gap-2">
                {service.key === 'docker' ? (
                  <Server className="size-4 text-muted-foreground" aria-hidden />
                ) : service.key === 'backups' ? (
                  <DatabaseBackup className="size-4 text-muted-foreground" aria-hidden />
                ) : service.key === 'jobs' ? (
                  <ListChecks className="size-4 text-muted-foreground" aria-hidden />
                ) : (
                  <Activity className="size-4 text-muted-foreground" aria-hidden />
                )}
                {SERVICE_LABELS[service.key] ?? service.key}
              </span>
              <StatusPill tone={serviceTone(service.status)}>
                {service.status === 'ok'
                  ? fr.health.operational
                  : service.status === 'degraded'
                    ? fr.health.degraded
                    : fr.health.tlsUnknown}
              </StatusPill>
            </div>
          ))}
        </div>
        {health.status !== 'ok' ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-warning">
            <AlertTriangle className="size-3.5" aria-hidden />
            {fr.health.degradedHint}
          </p>
        ) : null}
      </div>
    </div>
  )
}
