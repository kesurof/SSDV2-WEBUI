import { useEffect, useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useAppLogs } from '@/features/apps/useAppLogs'
import { fr } from '@/i18n/fr'

const LINES_OPTIONS = [100, 200, 500, 1000]
const MAX_STREAM_LINES = 1000

type StreamPayload = {
  ready?: boolean
  line?: string
  error?: string
}

export function AppLogsTab({ app, containers }: { app: string; containers: string[] }) {
  const [container, setContainer] = useState(
    containers.includes(app) ? app : (containers[0] ?? ''),
  )
  const [lines, setLines] = useState(200)
  const [follow, setFollow] = useState(false)
  const [streamLines, setStreamLines] = useState<string[]>([])
  const [streamError, setStreamError] = useState<string | null>(null)
  const logs = useAppLogs(app, container, lines, !follow)

  useEffect(() => {
    if (!follow || !container) {
      return
    }
    setStreamLines([])
    setStreamError(null)
    const params = new URLSearchParams({ container, lines: String(lines) })
    const source = new EventSource(`/api/v1/apps/${app}/logs/stream?${params.toString()}`)
    source.onmessage = (event) => {
      const payload = JSON.parse(event.data as string) as StreamPayload
      if (payload.line) {
        setStreamLines((current) => [
          ...current.slice(-(MAX_STREAM_LINES - 1)),
          payload.line as string,
        ])
      }
      if (payload.error) {
        setStreamError(payload.error)
      }
    }
    source.onerror = () => {
      setStreamError(fr.apps.logs.streamError)
    }
    return () => {
      source.close()
    }
  }, [app, container, lines, follow])

  if (containers.length === 0) {
    return <p className="text-sm text-muted-foreground">{fr.apps.emptyList}</p>
  }

  const displayed = follow ? streamLines : (logs.data?.lines ?? [])

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
        <Button variant={follow ? 'default' : 'outline'} onClick={() => setFollow(!follow)}>
          {follow ? fr.apps.logs.stopFollowing : fr.apps.logs.follow}
        </Button>
      </div>

      {streamError && (
        <Alert variant="destructive">
          <AlertTitle>{fr.common.error}</AlertTitle>
          <AlertDescription>{streamError}</AlertDescription>
        </Alert>
      )}

      {!follow && logs.isPending && (
        <p className="text-sm text-muted-foreground">{fr.common.loading}</p>
      )}

      {!follow && logs.isError && (
        <Alert variant="destructive">
          <AlertTitle>{fr.common.error}</AlertTitle>
          <AlertDescription>{logs.error.message}</AlertDescription>
        </Alert>
      )}

      {displayed.length === 0 ? (
        <p className="text-sm text-muted-foreground">{fr.apps.logs.empty}</p>
      ) : (
        <pre className="max-h-96 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs">
          {displayed.join('\n')}
        </pre>
      )}
    </div>
  )
}
