import { useMutation, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '@/api/client'
import type { Job } from '@/api/types'

export type DiagnosticsAction =
  | 'rebuild-registries'
  | 'cleanup-orphan-containers'
  | 'cleanup-dangling-volumes'

function useInvalidateDiagnostics() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['jobs'] })
    queryClient.invalidateQueries({ queryKey: ['diagnostics'] })
  }
}

export function useDiagnosticsAction() {
  const invalidate = useInvalidateDiagnostics()
  return useMutation({
    mutationFn: (action: DiagnosticsAction) =>
      apiFetch<Job>(`/diagnostics/${action}`, { method: 'POST' }),
    onSuccess: invalidate,
  })
}

export function useDiagnosticsPurge() {
  const invalidate = useInvalidateDiagnostics()
  return useMutation({
    mutationFn: ({ apps, deleteData }: { apps: string[]; deleteData: boolean }) =>
      apiFetch<Job>('/diagnostics/purge-apps', {
        method: 'POST',
        body: JSON.stringify({ apps, delete_data: deleteData }),
      }),
    onSuccess: invalidate,
  })
}
