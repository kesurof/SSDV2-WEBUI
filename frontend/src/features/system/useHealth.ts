import { useQuery } from '@tanstack/react-query'

import { apiFetch } from '@/api/client'
import type { Health } from '@/api/types'

export function useHealth() {
  return useQuery<Health>({
    queryKey: ['health'],
    queryFn: () => apiFetch<Health>('/health'),
    refetchInterval: 30_000,
  })
}
