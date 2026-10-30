import { useEffect, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useSaveUpdateSchedule,
  useUpdateSchedule,
} from '@/features/updates/useUpdateSchedule'
import { fr } from '@/i18n/fr'
import { formatDate } from '@/lib/format'

function validWindow(start: string, end: string) {
  const pattern = /^([01]\d|2[0-3]):[0-5]\d$/
  return pattern.test(start) && pattern.test(end) && start < end
}

export function UpdateScheduleCard() {
  const schedule = useUpdateSchedule()
  const save = useSaveUpdateSchedule()
  const [enabled, setEnabled] = useState(false)
  const [start, setStart] = useState('03:00')
  const [end, setEnd] = useState('05:00')

  useEffect(() => {
    if (schedule.data) {
      setEnabled(schedule.data.enabled)
      setStart(schedule.data.start)
      setEnd(schedule.data.end)
    }
  }, [schedule.data])

  if (!schedule.data) {
    if (schedule.isError) {
      return (
        <Card>
          <CardContent className="text-sm text-destructive">{fr.common.error}</CardContent>
        </Card>
      )
    }
    return null
  }
  const data = schedule.data

  const dirty = enabled !== data.enabled || start !== data.start || end !== data.end
  const windowValid = validWindow(start, end)
  const canSave = windowValid && dirty && !save.isPending

  function submit() {
    save.mutate(
      { enabled, start, end },
      {
        onSuccess: () => toast.success(fr.updates.schedule.saved),
        onError: (error) => toast.error(error.message),
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
          {fr.updates.schedule.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{fr.updates.schedule.hint}</p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          {fr.updates.schedule.enabled}
        </label>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="updates-schedule-start">{fr.updates.schedule.start}</Label>
            <Input
              id="updates-schedule-start"
              type="time"
              className="w-32"
              value={start}
              aria-invalid={!windowValid}
              aria-describedby={windowValid ? undefined : 'updates-schedule-error'}
              onChange={(event) => setStart(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="updates-schedule-end">{fr.updates.schedule.end}</Label>
            <Input
              id="updates-schedule-end"
              type="time"
              className="w-32"
              value={end}
              aria-invalid={!windowValid}
              aria-describedby={windowValid ? undefined : 'updates-schedule-error'}
              onChange={(event) => setEnd(event.target.value)}
            />
          </div>
          <Button size="sm" className="ml-auto" disabled={!canSave} onClick={submit}>
            {fr.updates.schedule.save}
          </Button>
        </div>
        {!windowValid ? (
          <p id="updates-schedule-error" role="alert" className="text-xs text-destructive">
            {fr.updates.schedule.invalidWindow}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {fr.updates.schedule.windowHint.replace('{timezone}', data.timezone)}
          </p>
        )}
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span>
            {fr.updates.schedule.lastRun} : {formatDate(data.last_run_at)}
          </span>
          <span>
            {fr.updates.schedule.nextRun} : {formatDate(data.next_run_at)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
