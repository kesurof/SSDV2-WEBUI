import { useEffect, useState } from 'react'
import { CircleHelp, Copy, RotateCw } from 'lucide-react'
import { toast } from 'sonner'

import { KeyValueList } from '@/components/app/key-value-list'
import { BrandPanel } from '@/components/app/brand-panel'
import { AppLink } from '@/components/app/app-link'
import { StatusPill } from '@/components/app/status-pill'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { JobStatusBadge } from '@/features/jobs/JobStatusBadge'
import { jobTypeLabel } from '@/features/jobs/JobsView'
import type { JobPrompt } from '@/features/jobs/useJobEvents'
import { fr } from '@/i18n/fr'
import { copyToClipboard } from '@/lib/clipboard'
import { formatDate } from '@/lib/format'
import type { Job } from '@/api/types'

function formatDuration(job: Job): string {
  if (!job.started_at || !job.finished_at) {
    return '—'
  }
  const start = new Date(job.started_at).getTime()
  const end = new Date(job.finished_at).getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return '—'
  }
  const seconds = Math.max(0, Math.round((end - start) / 1000))
  if (seconds < 60) {
    return `${seconds} s`
  }
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`
}

function JobPromptPanel({
  prompt,
  busy,
  onSubmit,
}: {
  prompt: JobPrompt
  busy: boolean
  onSubmit: (value: string) => void
}) {
  const [value, setValue] = useState(prompt.default)

  useEffect(() => {
    setValue(prompt.default)
  }, [prompt.id, prompt.default])

  return (
    <div className="min-w-0 max-w-full rounded-lg border border-warning/50 bg-warning/10 p-3 sm:p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-warning">
        <CircleHelp className="size-4" aria-hidden />
        {fr.jobs.prompt.title}
      </div>
      <p className="mt-1 break-words text-sm [overflow-wrap:anywhere]">{prompt.label}</p>

      {prompt.kind === 'choice' ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {prompt.options.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant="outline"
              className="h-auto min-h-9 max-w-full whitespace-normal break-all text-left"
              disabled={busy}
              onClick={() => onSubmit(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      ) : prompt.kind === 'confirm' ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={() => onSubmit(prompt.default)}>
            {prompt.default === 'o' ? fr.jobs.prompt.yes : fr.jobs.prompt.continue}
          </Button>
          {prompt.default === 'o' ? (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onSubmit('n')}>
              {fr.jobs.prompt.no}
            </Button>
          ) : null}
        </div>
      ) : (
        <form
          className="mt-3 min-w-0 space-y-2"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit(value)
          }}
        >
          <Label htmlFor="job-prompt-input" className="sr-only">
            {prompt.label}
          </Label>
          <Input
            id="job-prompt-input"
            className="min-w-0 w-full max-w-full"
            type={prompt.secret ? 'password' : 'text'}
            autoComplete="off"
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <Button type="submit" size="sm" disabled={busy}>
            {fr.jobs.prompt.submit}
          </Button>
        </form>
      )}
    </div>
  )
}

export function JobDetailView({
  job,
  lines,
  done,
  prompt,
  onInput,
  onRetry,
}: {
  job: Job
  lines: string[]
  done: boolean
  prompt?: JobPrompt | null
  onInput?: (value: string) => void
  onRetry?: () => void
}) {
  async function copyLogs() {
    const ok = await copyToClipboard(lines.join('\n'))
    if (ok) {
      toast.success(fr.common.copied)
    } else {
      toast.error(fr.common.copyError)
    }
  }

  return (
    <div className="min-w-0 w-full max-w-full space-y-4">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="break-words text-lg font-semibold [overflow-wrap:anywhere]">
            #{job.id} — {jobTypeLabel(job.type)} {job.type.startsWith('app_') ? <AppLink name={job.target} className="break-all text-primary" /> : job.target}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <JobStatusBadge status={job.status} />
            <span className="text-xs text-muted-foreground">{formatDate(job.created_at)}</span>
          </div>
        </div>
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCw className="size-3.5" aria-hidden />
            {fr.jobs.retry}
          </Button>
        ) : null}
      </div>

      {job.status === 'failed' && job.message && (
        <Alert variant="destructive">
          <AlertTitle>{fr.jobs.status.failed}</AlertTitle>
          <AlertDescription className="break-words [overflow-wrap:anywhere]">{job.message}</AlertDescription>
        </Alert>
      )}

      {prompt && onInput ? <JobPromptPanel prompt={prompt} busy={false} onSubmit={onInput} /> : null}

      <BrandPanel as="div" className="p-3 sm:p-4">
        <KeyValueList
        items={[
          { label: fr.jobs.columns.type, value: jobTypeLabel(job.type) },
          { label: fr.jobs.columns.target, value: job.type.startsWith('app_') ? <AppLink name={job.target} /> : job.target },
          { label: fr.jobs.detail.launchedAt, value: formatDate(job.created_at) },
          { label: fr.jobs.detail.duration, value: formatDuration(job) },
          {
            label: fr.jobs.detail.exitCode,
            value: job.exit_code === null ? '—' : String(job.exit_code),
          },
          {
            label: fr.jobs.detail.progress,
            value: (
              <StatusPill tone={done ? 'ok' : 'info'}>
                {done ? fr.jobs.detail.finished : fr.jobs.status.running}
              </StatusPill>
            ),
          },
        ]}
      />

      </BrandPanel>

      <div className="ssdv2-module-panel min-w-0 max-w-full space-y-2 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">{fr.jobs.events}</div>
          <Button
            variant="outline"
            size="sm"
            disabled={lines.length === 0}
            onClick={copyLogs}
          >
            <Copy className="size-3.5" aria-hidden />
            {fr.common.copy}
          </Button>
        </div>
        <pre data-testid="job-log-console" className="control-console block w-full min-w-0 max-w-full max-h-[55svh] min-h-36 overflow-x-auto overflow-y-auto overscroll-x-contain rounded-lg p-3 font-mono text-xs leading-relaxed whitespace-pre sm:p-4 lg:max-h-[480px]">
          {lines.length === 0
            ? done
              ? fr.apps.logs.empty
              : fr.common.loading
            : lines.join('\n')}
        </pre>
      </div>
    </div>
  )
}
