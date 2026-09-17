import { useMutation, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '@/api/client'
import type { Job } from '@/api/types'

export type DiagnosticsAction =
  | 'rebuild-registries'
  | 'cleanup-orphan-containers'
  | 'cleanup-dangling-volumes'

export function useDiagnosticsAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (action: DiagnosticsAction) =>
      apiFetch<Job>(`/diagnostics/${action}`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['diagnostics'] })
    },
  })
}
