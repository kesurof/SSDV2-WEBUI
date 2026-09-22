import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '@/api/client'
import type { Job } from '@/api/types'

export type AppAction =
  | 'start'
  | 'stop'
  | 'restart'
  | 'install'
  | 'remove'
  | 'reinstall'
  | 'recreate'
  | 'backup'

export type AppActionRequest = {
  action: AppAction
  body?: Record<string, unknown>
}

export function useJobs() {
  return useQuery<Job[]>({
    queryKey: ['jobs'],
    queryFn: () => apiFetch<Job[]>('/jobs?limit=200'),
    refetchInterval: 5_000,
  })
}

export function useJob(jobId: string) {
  return useQuery<Job>({
    queryKey: ['jobs', jobId],
    queryFn: () => apiFetch<Job>(`/jobs/${jobId}`),
    refetchInterval: 5_000,
  })
}

export function useSubmitJobInput(jobId: string) {
  return useMutation({
    mutationFn: ({ promptId, value }: { promptId: string; value: string }) =>
      apiFetch<Job>(`/jobs/${jobId}/input`, {
        method: 'POST',
        body: JSON.stringify({ prompt_id: promptId, value }),
      }),
  })
}

export function useAppAction(app: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ action, body }: AppActionRequest) =>
      apiFetch<Job>(`/apps/${app}/${action}`, {
        method: 'POST',
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
  })
}
