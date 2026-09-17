import { useEffect, useState } from 'react'

type JobEventPayload = {
  id?: number
  line?: string
  status?: string
  done?: boolean
}

export function useJobEvents(jobId: string | undefined) {
  const [lines, setLines] = useState<string[]>([])
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!jobId || !/^\d+$/.test(jobId)) {
      return
    }
    setLines([])
    setDone(false)
    const source = new EventSource(`/api/v1/jobs/${jobId}/events`)
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
  }, [jobId])

  return { lines, done }
}
