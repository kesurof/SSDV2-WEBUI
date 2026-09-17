import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { JobDetailView } from '@/features/jobs/JobDetailView'
import { useJob } from '@/features/jobs/useJobs'
import { fr } from '@/i18n/fr'

type JobEventPayload = {
  id?: number
  line?: string
  status?: string
  done?: boolean
}

export function JobDetailPage() {
  const { id = '' } = useParams()
  const job = useJob(id)
  const [lines, setLines] = useState<string[]>([])
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!/^\d+$/.test(id)) {
      return
    }
    setLines([])
    setDone(false)
    const source = new EventSource(`/api/v1/jobs/${id}/events`)
    source.onmessage = (event) => {
      const payload = JSON.parse(event.data as string) as JobEventPayload
      if (payload.line) {
        setLines((current) => [...current, payload.line as string])
      }
      if (payload.done) {
        setDone(true)
        source.close()
      }
    }
    return () => {
      source.close()
    }
  }, [id])

  if (job.isPending) {
    return <p className="text-sm text-muted-foreground">{fr.common.loading}</p>
  }

  if (job.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{fr.common.error}</AlertTitle>
        <AlertDescription>{job.error.message}</AlertDescription>
      </Alert>
    )
  }

  return <JobDetailView job={job.data} lines={lines} done={done} />
}
