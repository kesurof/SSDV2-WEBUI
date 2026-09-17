import { useQuery } from '@tanstack/react-query'

import { apiFetch } from '@/api/client'
import type { AppState } from '@/api/types'

export function useApps() {
  return useQuery<AppState[]>({
    queryKey: ['apps'],
    queryFn: () => apiFetch<AppState[]>('/apps'),
    refetchInterval: 30_000,
  })
}
