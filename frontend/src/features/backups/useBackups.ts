import { useQuery } from '@tanstack/react-query'

import { apiFetch } from '@/api/client'
import type { Backup } from '@/api/types'

export function useBackups() {
  return useQuery<Backup[]>({
    queryKey: ['backups'],
    queryFn: () => apiFetch<Backup[]>('/backups'),
    refetchInterval: 60_000,
  })
}
