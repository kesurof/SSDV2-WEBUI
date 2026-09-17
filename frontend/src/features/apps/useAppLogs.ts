import { useQuery } from '@tanstack/react-query'

import { apiFetch } from '@/api/client'
import type { Logs } from '@/api/types'

export function useAppLogs(app: string, container: string, lines: number) {
  const params = new URLSearchParams({ container, lines: String(lines) })
  return useQuery<Logs>({
    queryKey: ['apps', app, 'logs', container, lines],
    queryFn: () => apiFetch<Logs>(`/apps/${app}/logs?${params.toString()}`),
    refetchInterval: 5_000,
  })
}
