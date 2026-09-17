import { Link } from 'react-router-dom'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fr } from '@/i18n/fr'
import type { SystemSummary } from '@/api/types'

function formatMemory(bytes: number | null): string {
  if (bytes === null) {
    return '—'
  }
  return `${(bytes / 1024 ** 3).toFixed(1)} Go`
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  )
}

export function DashboardView({ summary }: { summary: SystemSummary }) {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">{fr.dashboard.title}</h1>

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

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{fr.dashboard.host}</CardTitle>
          </CardHeader>
          <CardContent>
            <Field label={fr.dashboard.hostname}>{summary.host.hostname ?? '—'}</Field>
            <Field label={fr.dashboard.os}>{summary.host.os ?? '—'}</Field>
            <Field label={fr.dashboard.kernel}>{summary.host.kernel ?? '—'}</Field>
            <Field label={fr.dashboard.architecture}>{summary.host.architecture ?? '—'}</Field>
            <Field label={fr.dashboard.cpus}>{summary.host.cpus ?? '—'}</Field>
            <Field label={fr.dashboard.memory}>{formatMemory(summary.host.memory_bytes)}</Field>
            <Field label={fr.dashboard.dockerVersion}>
              {summary.host.server_version ?? '—'}
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{fr.dashboard.ssdv2}</CardTitle>
          </CardHeader>
          <CardContent>
            <Field label={fr.dashboard.branch}>{summary.ssdv2.branch ?? '—'}</Field>
            <Field label={fr.dashboard.commit}>
              <span className="font-mono text-xs">
                {summary.ssdv2.commit ? summary.ssdv2.commit.slice(0, 10) : '—'}
              </span>
            </Field>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <div className="text-2xl font-semibold">{summary.ssdv2.apps_total}</div>
                <div className="text-xs text-muted-foreground">{fr.dashboard.appsTotal}</div>
              </div>
              <div>
                <div className="text-2xl font-semibold">{summary.ssdv2.installed}</div>
                <div className="text-xs text-muted-foreground">{fr.dashboard.installed}</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-emerald-600">
                  {summary.ssdv2.running}
                </div>
                <div className="text-xs text-muted-foreground">{fr.dashboard.running}</div>
              </div>
              <div>
                <div className="text-2xl font-semibold">{summary.ssdv2.stopped}</div>
                <div className="text-xs text-muted-foreground">{fr.dashboard.stopped}</div>
              </div>
            </div>
            <Link to="/apps" className="mt-3 inline-block text-sm text-primary hover:underline">
              {fr.dashboard.viewApps}
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
