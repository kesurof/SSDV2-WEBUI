import { useEffect, useState } from 'react'

export type JobPromptKind = 'text' | 'secret' | 'confirm' | 'choice'

export type JobPromptOption = {
  value: string
  label: string
}

export type JobPrompt = {
  id: string
  spec: string
  label: string
  kind: JobPromptKind
  secret: boolean
  default: string
  options: JobPromptOption[]
}

type JobEventPayload = {
  id?: number
  line?: string
  status?: string
  done?: boolean
  prompt?: JobPrompt
}

export function useJobEvents(jobId: string | undefined) {
  const [lines, setLines] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const [prompt, setPrompt] = useState<JobPrompt | null>(null)

  useEffect(() => {
    if (!jobId || !/^\d+$/.test(jobId)) {
      return
    }
    setLines([])
    setDone(false)
    setPrompt(null)
    const source = new EventSource(`/api/v1/jobs/${jobId}/events`)
    source.onmessage = (event) => {
      const payload = JSON.parse(event.data as string) as JobEventPayload
      if (payload.line) {
        setLines((current) => [...current, payload.line as string])
      }
      if (payload.prompt) {
        setPrompt(payload.prompt)
      }
      if (payload.done) {
        setDone(true)
        setPrompt(null)
        source.close()
      }
    }
    return () => {
      source.close()
    }
  }, [jobId])

  return { lines, done, prompt, dismissPrompt: () => setPrompt(null) }
}
