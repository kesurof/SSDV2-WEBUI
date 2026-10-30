import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '@/api/client'
import type { UpdateSchedule } from '@/api/types'

export type UpdateScheduleInput = {
  enabled: boolean
  start: string
  end: string
}

export function useUpdateSchedule() {
  return useQuery<UpdateSchedule>({
    queryKey: ['updates', 'schedule'],
    queryFn: () => apiFetch<UpdateSchedule>('/updates/schedule'),
    staleTime: 60_000,
  })
}

export function useSaveUpdateSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateScheduleInput) =>
      apiFetch<UpdateSchedule>('/updates/schedule', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: (schedule) => {
      queryClient.setQueryData(['updates', 'schedule'], schedule)
    },
  })
}
