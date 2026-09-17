import { Link } from 'react-router-dom'
import { TriangleAlert } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { AppLogsTab } from '@/features/apps/AppLogsTab'
import { StatusBadge } from '@/features/apps/StatusBadge'
import { fr } from '@/i18n/fr'
import type { AppDetail, Container } from '@/api/types'

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  )
}

function ContainerTable({ containers }: { containers: Container[] }) {
  if (containers.length === 0) {
    return <p className="text-sm text-muted-foreground">{fr.apps.emptyList}</p>
  }
  return (
    <div className="rounded-md border">
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

export function AppDetailView({ app }: { app: AppDetail }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/apps"
            className="text-xs text-muted-foreground hover:underline"
          >
            {fr.apps.back}
          </Link>
          <h1 className="text-lg font-semibold">{app.name}</h1>
          <p className="text-sm text-muted-foreground">{app.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {app.warnings.length > 0 && (
            <Badge variant="outline" className="border-amber-500 text-amber-600">
              <TriangleAlert className="size-3" /> {app.warnings.length}
            </Badge>
          )}
          <StatusBadge status={app.runtime_status} />
        </div>
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
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Field label={fr.apps.fields.url}>
              {app.url ? (
                <a
                  href={app.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  {app.url}
                </a>
              ) : (
                '—'
              )}
            </Field>
            <Field label={fr.apps.fields.image}>{app.image ?? '—'}</Field>
            <Field label={fr.apps.fields.subdomain}>{app.ssddb?.subdomain ?? '—'}</Field>
            <Field label={fr.apps.fields.port}>{app.ssddb?.port ?? '—'}</Field>
          </div>
        </TabsContent>

        <TabsContent value="containers" className="pt-4">
          <ContainerTable containers={app.container_list} />
        </TabsContent>

        <TabsContent value="logs" className="pt-4">
          <AppLogsTab app={app.name} containers={app.container_list.map((item) => item.name)} />
        </TabsContent>

        <TabsContent value="volumes" className="pt-4">
          <List values={app.registries.volumes} />
        </TabsContent>

        <TabsContent value="network" className="pt-4">
          <List values={app.registries.dns} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
