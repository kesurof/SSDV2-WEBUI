import { useQuery } from '@tanstack/react-query'

import { apiFetch } from '@/api/client'
import type { AppAuth } from '@/api/types'

export function useAppAuth(app: string) {
  return useQuery<AppAuth>({
    queryKey: ['apps', app, 'auth'],
    queryFn: () => apiFetch<AppAuth>(`/apps/${app}/auth`),
    staleTime: 60_000,
    retry: false,
  })
}
