import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DiagnosticsActions } from '@/features/diagnostics/DiagnosticsActions'
import { DiagnosticsStaleApps } from '@/features/diagnostics/DiagnosticsStaleApps'
import { useDiagnostics } from '@/features/system/useSystem'
import { PageHeader } from '@/components/app/page-header'
import { fr } from '@/i18n/fr'
import type { Diagnostics } from '@/api/types'

function ValueList({ values }: { values: string[] }) {
  if (values.length === 0) {
    return <p className="text-sm text-muted-foreground">{fr.diagnostics.none}</p>
  }
  return (
    <ul className="list-inside list-disc font-mono text-xs">
      {values.map((value) => (
        <li key={value}>{value}</li>
      ))}
    </ul>
  )
}

export function DiagnosticsView({
  checks,
  warnings,
}: Pick<Diagnostics, 'checks' | 'warnings'>) {
  const stale = checks.stale_apps ?? []
  const repairable = checks.missing_registries.filter((app) => !stale.includes(app))

  return (
    <div className="space-y-4">
      <PageHeader
        title={fr.diagnostics.title}
        subtitle="Vérifiez l'état de votre instance et réparez les problèmes courants."
      />

      <p className="text-sm text-muted-foreground">{fr.diagnostics.intro}</p>

      {warnings.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>{fr.apps.alerts}</AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc">
              {warnings.map((warning) => (
                <li key={warning}>{fr.warnings[warning as keyof typeof fr.warnings] ?? warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{fr.diagnostics.missingRegistries}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">{fr.diagnostics.missingRegistriesHelp}</p>
            <p className="text-xs text-muted-foreground">{fr.diagnostics.missingRegistriesCause}</p>
            <ValueList values={repairable} />
            <p className="text-xs text-primary">{fr.diagnostics.missingRegistriesAction}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{fr.diagnostics.orphanContainers}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">{fr.diagnostics.orphanContainersHelp}</p>
            <p className="text-xs text-muted-foreground">{fr.diagnostics.orphanContainersCause}</p>
            <ValueList values={checks.orphan_containers} />
            <p className="text-xs text-primary">{fr.diagnostics.orphanContainersAction}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{fr.diagnostics.danglingVolumes}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">{fr.diagnostics.danglingVolumesHelp}</p>
            <p className="text-2xl font-semibold">{checks.dangling_volumes}</p>
            <p className="text-xs text-primary">{fr.diagnostics.danglingVolumesAction}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function DiagnosticsPage() {
  const diagnostics = useDiagnostics()

  if (diagnostics.isPending) {
    return <p className="text-sm text-muted-foreground">{fr.common.loading}</p>
  }

  if (diagnostics.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{fr.common.error}</AlertTitle>
        <AlertDescription>{diagnostics.error.message}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <DiagnosticsView checks={diagnostics.data.checks} warnings={diagnostics.data.warnings} />
      <DiagnosticsStaleApps apps={diagnostics.data.checks.stale_apps ?? []} />
      <DiagnosticsActions />
    </div>
  )
}
