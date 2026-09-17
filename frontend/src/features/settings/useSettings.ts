import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '@/api/client'
import type { AppAuthSummary, Config, Job } from '@/api/types'
import type { AuthType } from '@/features/auth/authTypes'

export function useAppAuthList() {
  return useQuery<AppAuthSummary[]>({
    queryKey: ['auth', 'apps'],
    queryFn: () => apiFetch<AppAuthSummary[]>('/auth/apps'),
    refetchInterval: 60_000,
  })
}

export function useBulkAuth() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { apps: string[]; auth: AuthType }) =>
      apiFetch<Job>('/auth/bulk', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['auth', 'apps'] })
    },
  })
}

export function useConfig() {
  return useQuery<Config>({
    queryKey: ['config'],
    queryFn: () => apiFetch<Config>('/config'),
    staleTime: 60_000,
  })
}
