import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { apiUrl } from '@/api/url'
import { meQueryKey } from '@/features/auth/useAuth'
import { useEventStream } from '@/lib/useEventStream'

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
  const valid = jobId && /^\d+$/.test(jobId) ? jobId : null
  const [lines, setLines] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const [prompt, setPrompt] = useState<JobPrompt | null>(null)
  const [error, setError] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    setLines([])
    setDone(false)
    setPrompt(null)
    setError(false)
  }, [valid])

  useEventStream({
    key: valid,
    enabled: !done,
    buildUrl: (after) => apiUrl(`/jobs/${valid}/events${after ? `?after=${after}` : ''}`),
    onMessage: (data) => {
      try {
        const payload = JSON.parse(data) as JobEventPayload
        if (payload.line) {
          setLines((current) => [...current, payload.line as string])
        }
        if (payload.prompt) {
          setPrompt(payload.prompt)
        }
        if (payload.done) {
          setDone(true)
          setPrompt(null)
        }
      } catch {
        setError(true)
      }
    },
    onAuthLost: () => {
      setError(true)
      queryClient.setQueryData(meQueryKey, null)
    },
  })

  return { lines, done, prompt, error, dismissPrompt: () => setPrompt(null) }
}
