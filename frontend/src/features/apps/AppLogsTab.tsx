import { useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { useAppLogs } from '@/features/apps/useAppLogs'
import { fr } from '@/i18n/fr'

const LINES_OPTIONS = [100, 200, 500, 1000]

export function AppLogsTab({
  app,
  containers,
}: {
  app: string
  containers: string[]
}) {
  const [container, setContainer] = useState(
    containers.includes(app) ? app : (containers[0] ?? ''),
  )
  const [lines, setLines] = useState(200)
  const logs = useAppLogs(app, container, lines)

  if (containers.length === 0) {
    return <p className="text-sm text-muted-foreground">{fr.apps.emptyList}</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="logs-container">{fr.apps.logs.container}</Label>
          <select
            id="logs-container"
            value={container}
            onChange={(event) => setContainer(event.target.value)}
            className="h-9 rounded-md border bg-transparent px-2 text-sm"
          >
            {containers.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="logs-lines">{fr.apps.logs.lines}</Label>
          <select
            id="logs-lines"
            value={lines}
            onChange={(event) => setLines(Number(event.target.value))}
            className="h-9 rounded-md border bg-transparent px-2 text-sm"
          >
            {LINES_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      {logs.isPending && <p className="text-sm text-muted-foreground">{fr.common.loading}</p>}

      {logs.isError && (
        <Alert variant="destructive">
          <AlertTitle>{fr.common.error}</AlertTitle>
          <AlertDescription>{logs.error.message}</AlertDescription>
        </Alert>
      )}

      {logs.data &&
        (logs.data.lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">{fr.apps.logs.empty}</p>
        ) : (
          <pre className="max-h-96 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs">
            {logs.data.lines.join('\n')}
          </pre>
        ))}
    </div>
  )
}
