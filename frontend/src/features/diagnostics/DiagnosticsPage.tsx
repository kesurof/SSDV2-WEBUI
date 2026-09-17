import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DiagnosticsActions } from '@/features/diagnostics/DiagnosticsActions'
import { useDiagnostics } from '@/features/system/useSystem'
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
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">{fr.diagnostics.title}</h1>

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
          <CardContent>
            <ValueList values={checks.missing_registries} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{fr.diagnostics.orphanContainers}</CardTitle>
          </CardHeader>
          <CardContent>
            <ValueList values={checks.orphan_containers} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{fr.diagnostics.danglingVolumes}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{checks.dangling_volumes}</p>
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
      <DiagnosticsActions />
    </div>
  )
}
