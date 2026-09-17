import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '@/api/client'
import type { SetupRequest, SetupStatus, User } from '@/api/types'

export function useSetupStatus() {
  return useQuery<SetupStatus>({
    queryKey: ['setup'],
    queryFn: () => apiFetch<SetupStatus>('/setup/status'),
    staleTime: 30_000,
  })
}

export function useRunSetup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: SetupRequest) =>
      apiFetch<User>('/setup', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setup'] })
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
  })
}
