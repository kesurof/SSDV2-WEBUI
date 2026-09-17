import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  Boxes,
  Cpu,
  ExternalLink,
  Globe,
  Link2,
  MemoryStick,
  Rocket,
  TriangleAlert,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { StatusPill } from '@/components/app/status-pill'
import type { StatusTone } from '@/components/app/status-pill'
import { KeyValueList } from '@/components/app/key-value-list'
import { ProgressBar } from '@/components/app/progress-bar'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { AppDetail, AppHistoryEvent, AppStats, AppStorage, Backup, Container } from '@/api/types'
import { AppHistoryView } from '@/features/apps/AppHistoryView'
import type { HistoryFilter } from '@/features/apps/AppHistoryView'
import { AppLogsTab } from '@/features/apps/AppLogsTab'
import { StatusBadge } from '@/features/apps/StatusBadge'
import { jobTypeLabel } from '@/features/jobs/JobsView'
import { fr } from '@/i18n/fr'
import { formatBytes, formatDate, formatPercent } from '@/lib/format'

function formatUptime(startedAt: string | null | undefined): string {
  if (!startedAt) {
    return '—'
  }
  const start = new Date(startedAt).getTime()
  if (Number.isNaN(start)) {
    return '—'
  }
  const minutes = Math.max(0, Math.floor((Date.now() - start) / 60_000))
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  if (days > 0) {
    return `${days} j ${hours} h`
  }
  if (hours > 0) {
    return `${hours} h ${minutes % 60} min`
  }
  return `${minutes} min`
}

function warningLabel(code: string): string {
  return fr.warnings[code as keyof typeof fr.warnings] ?? code
}

function stateLabel(state: string): string {
  return fr.containerState[state as keyof typeof fr.containerState] ?? state
}

function healthLabel(health: string | null): string {
  if (!health) {
    return fr.apps.emptyList
  }
  return fr.containerHealth[health as keyof typeof fr.containerHealth] ?? health
}

function containerTone(container: Container): StatusTone {
  if (container.state !== 'running') return 'muted'
  if (container.health === 'unhealthy') return 'err'
  return 'ok'
}

function ContainerTable({ containers }: { containers: Container[] }) {
  if (containers.length === 0) {
    return <p className="text-sm text-muted-foreground">{fr.apps.emptyList}</p>
  }
  return (
    <div className="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{fr.apps.containerColumns.name}</TableHead>
            <TableHead>{fr.apps.containerColumns.image}</TableHead>
            <TableHead>{fr.apps.containerColumns.state}</TableHead>
            <TableHead>{fr.apps.containerColumns.health}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {containers.map((container) => (
            <TableRow key={container.name}>
              <TableCell className="font-medium">{container.name}</TableCell>
              <TableCell className="font-mono text-xs">{container.image ?? '—'}</TableCell>
              <TableCell>{stateLabel(container.state)}</TableCell>
              <TableCell>{healthLabel(container.health)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function List({ values }: { values: string[] }) {
  if (values.length === 0) {
    return <p className="text-sm text-muted-foreground">{fr.apps.emptyList}</p>
  }
  return (
    <ul className="list-inside list-disc text-sm">
      {values.map((value) => (
        <li key={value} className="font-mono text-xs">
          {value}
        </li>
      ))}
    </ul>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  )
}

function filterHistory(events: AppHistoryEvent[], filter: HistoryFilter): AppHistoryEvent[] {
  if (filter === 'all') return events
  if (filter === 'errors') {
    return events.filter((event) => ['failed', 'error', 'cancelled'].includes(event.result))
  }
  return events.filter((event) => event.kind === filter)
}

export function AppDetailView({
  app,
  auth,
  stats,
  backups,
  history,
  env,
  storage,
  actions,
  onRecreate,
}: {
  app: AppDetail
  auth: string | null
  stats?: AppStats
  backups?: Backup[]
  history?: AppHistoryEvent[]
  env?: Array<{ name: string; value: string }>
  storage?: AppStorage
  actions?: ReactNode
  onRecreate?: () => void
}) {
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all')
  const companions = app.container_list.filter((container) => container.name !== app.name)
  const appBackups = (backups ?? []).filter((backup) => backup.app === app.name)
  const lastBackup = appBackups[0]
  const lastJob = (history ?? []).find((event) => event.kind === 'job')
  const mainContainer =
    app.container_list.find((container) => container.name === app.name) ?? app.container_list[0]
  const lastDeployment = mainContainer?.started_at ?? mainContainer?.created_at ?? null
  const envVariables = stats?.containers ?? []

  const registryUrl = app.image?.includes('ghcr.io')
    ? `https://${app.image.split('/').slice(0, 2).join('/')}`
    : app.image
      ? `https://hub.docker.com/r/${app.image.split(':')[0].replace(/^docker\.io\//, '')}`
      : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Boxes className="size-7" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{app.name}</h1>
              <StatusBadge status={app.runtime_status} />
              {app.warnings.length > 0 && (
                <Badge variant="outline" className="border-warning text-warning">
                  <TriangleAlert className="size-3" aria-hidden /> {app.warnings.length}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{app.description}</p>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      {app.warnings.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>{fr.apps.alerts}</AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc">
              {app.warnings.map((warning) => (
                <li key={warning}>{warningLabel(warning)}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{fr.apps.tabs.overview}</TabsTrigger>
          <TabsTrigger value="containers">
            {fr.apps.tabs.containers} ({app.containers})
          </TabsTrigger>
          <TabsTrigger value="logs">{fr.apps.tabs.logs}</TabsTrigger>
          <TabsTrigger value="volumes">{fr.apps.tabs.volumes}</TabsTrigger>
          <TabsTrigger value="network">{fr.apps.tabs.network}</TabsTrigger>
          <TabsTrigger value="variables">{fr.apps.tabs.variables}</TabsTrigger>
          <TabsTrigger value="history">{fr.apps.tabs.history}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title={fr.apps.detail.info}>
              <KeyValueList
                items={[
                  { label: fr.apps.fields.image, value: <span className="font-mono text-xs">{app.image ?? '—'}</span> },
                  { label: fr.apps.detail.type, value: app.available ? 'Application Docker' : '—' },
                  { label: fr.apps.fields.status, value: <StatusBadge status={app.runtime_status} /> },
                  {
                    label: fr.apps.detail.containerId,
                    value: (
                      <span className="font-mono text-xs">
                        {app.container_list.find((container) => container.name === app.name)?.name ?? '—'}
                      </span>
                    ),
                  },
                  { label: fr.apps.fields.subdomain, value: app.ssddb?.subdomain ?? '—' },
                  { label: fr.apps.detail.since, value: formatUptime(lastDeployment) },
                ]}
              />
            </Card>

            <Card title={fr.apps.detail.access}>
              <KeyValueList
                items={[
                  {
                    label: fr.apps.fields.url,
                    value: app.url ? (
                      <a href={app.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        {app.url}
                      </a>
                    ) : (
                      '—'
                    ),
                  },
                  { label: fr.apps.fields.auth, value: auth ?? '—' },
                  { label: fr.apps.fields.port, value: app.ssddb?.port ?? '—' },
                  {
                    label: fr.apps.detail.tls,
                    value: app.url?.startsWith('https') ? (
                      <StatusPill tone="ok">{fr.health.tlsValid}</StatusPill>
                    ) : (
                      '—'
                    ),
                  },
                  { label: 'DNS', value: app.registries.dns.length > 0 ? <List values={app.registries.dns} /> : '—' },
                ]}
              />
            </Card>

            <Card title={fr.apps.detail.companions}>
              {companions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{fr.apps.detail.noCompanions}</p>
              ) : (
                <div className="space-y-2">
                  {companions.map((container) => (
                    <div
                      key={container.name}
                      className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-b-0"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{container.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {container.image ?? '—'}
                        </span>
                      </span>
                      <StatusPill tone={containerTone(container)}>
                        {stateLabel(container.state)}
                      </StatusPill>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title={fr.apps.detail.resources}>
              {envVariables.length === 0 ? (
                <p className="text-sm text-muted-foreground">{fr.common.none}</p>
              ) : (
                <div className="space-y-4">
                  {envVariables.map((container) => (
                    <div key={container.name}>
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 font-medium">
                          <Cpu className="size-3.5 text-muted-foreground" aria-hidden />
                          {container.name}
                        </span>
                        <span className="font-semibold">{formatPercent(container.cpu_percent)}</span>
                      </div>
                      <ProgressBar value={container.cpu_percent ?? 0} />
                      <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <MemoryStick className="size-3.5" aria-hidden />
                          {formatBytes(container.memory_used_bytes)}
                        </span>
                        <span>{formatPercent(container.memory_percent)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title={fr.apps.detail.backups}>
              {lastBackup ? (
                <KeyValueList
                  items={[
                    { label: fr.apps.detail.lastBackup, value: formatDate(lastBackup.created_at) },
                    { label: fr.apps.detail.size, value: formatBytes(lastBackup.size) },
                    { label: fr.apps.detail.result, value: <StatusPill tone="ok">{fr.jobs.status.success}</StatusPill> },
                  ]}
                />
              ) : (
                <p className="text-sm text-muted-foreground">{fr.backups.empty}</p>
              )}
            </Card>

            <Card title={fr.apps.tabs.volumes}>
              {!storage || storage.volumes.length === 0 ? (
                <p className="text-sm text-muted-foreground">{fr.apps.emptyList}</p>
              ) : (
                <>
                  <KeyValueList
                    items={storage.volumes.map((volume) => ({
                      label: volume.name,
                      value: volume.size_bytes === null ? fr.common.none : formatBytes(volume.size_bytes),
                    }))}
                  />
                  {storage.total_size_bytes !== null && storage.volumes.length > 1 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {fr.apps.detail.total} : {formatBytes(storage.total_size_bytes)}
                    </p>
                  ) : null}
                </>
              )}
            </Card>

            <Card title={fr.apps.detail.deployment}>
              <KeyValueList
                items={[
                  {
                    label: fr.apps.detail.lastDeploy,
                    value: lastDeployment ? formatDate(lastDeployment) : '—',
                  },
                  { label: fr.apps.fields.image, value: <span className="font-mono text-xs">{mainContainer?.image ?? app.image ?? '—'}</span> },
                  {
                    label: fr.apps.detail.imageId,
                    value: (
                      <span className="font-mono text-xs">
                        {mainContainer?.image_id ? mainContainer.image_id.replace('sha256:', '').slice(0, 12) : '—'}
                      </span>
                    ),
                  },
                  ...(lastJob
                    ? [
                        { label: fr.apps.detail.result, value: <StatusPill tone={lastJob.result === 'success' ? 'ok' : 'err'}>{lastJob.result}</StatusPill> },
                        { label: fr.apps.detail.type, value: jobTypeLabel(lastJob.label) },
                      ]
                    : []),
                ]}
              />
              {onRecreate ? (
                <Button variant="outline" size="sm" className="mt-3" onClick={onRecreate}>
                  <Rocket className="size-3.5" aria-hidden />
                  {fr.apps.detail.recreate}
                </Button>
              ) : null}
            </Card>

            <Card title={fr.apps.detail.links}>
              <div className="space-y-1">
                {app.url ? (
                  <a
                    href={app.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-2 border-b py-2 text-sm hover:text-primary"
                  >
                    {fr.apps.detail.openApp}
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                ) : null}
                {registryUrl ? (
                  <a
                    href={registryUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-2 border-b py-2 text-sm hover:text-primary"
                  >
                    {fr.apps.detail.dockerHub}
                    <Link2 className="size-3.5" aria-hidden />
                  </a>
                ) : null}
                <Link
                  to={`/apps/${app.name}/history`}
                  className="flex items-center justify-between gap-2 py-2 text-sm hover:text-primary"
                >
                  {fr.apps.tabs.history}
                  <Globe className="size-3.5" aria-hidden />
                </Link>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="containers" className="pt-4">
          <ContainerTable containers={app.container_list} />
        </TabsContent>

        <TabsContent value="logs" className="pt-4">
          <AppLogsTab app={app.name} containers={app.container_list.map((item) => item.name)} />
        </TabsContent>

        <TabsContent value="volumes" className="pt-4">
          <Card title={fr.apps.tabs.volumes}>
            <List values={app.registries.volumes} />
          </Card>
        </TabsContent>

        <TabsContent value="network" className="pt-4">
          <Card title={fr.apps.tabs.network}>
            <List values={app.registries.dns} />
          </Card>
        </TabsContent>

        <TabsContent value="variables" className="pt-4">
          <Card title={fr.apps.detail.env}>
            <p className="mb-3 text-xs text-muted-foreground">
              Seules les variables non sensibles sont affichées.
            </p>
            {!env || env.length === 0 ? (
              <p className="text-sm text-muted-foreground">{fr.common.none}</p>
            ) : (
              <KeyValueList
                items={env.map((variable) => ({
                  label: variable.name,
                  value: <span className="font-mono text-xs">{variable.value}</span>,
                }))}
              />
            )}
          </Card>
        </TabsContent>

        <TabsContent value="history" className="pt-4">
          <AppHistoryView
            app={app.name}
            events={filterHistory(history ?? [], historyFilter)}
            filter={historyFilter}
            onFilterChange={setHistoryFilter}
            compact
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
