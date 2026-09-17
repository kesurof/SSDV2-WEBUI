import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '@/api/client'
import type { AuditEvent, NotificationList } from '@/api/types'

export function useNotifications() {
  return useQuery<NotificationList>({
    queryKey: ['notifications'],
    queryFn: () => apiFetch<NotificationList>('/notifications'),
    refetchInterval: 30_000,
  })
}

export function useAuditEvents() {
  return useQuery<AuditEvent[]>({
    queryKey: ['audit'],
    queryFn: () => apiFetch<AuditEvent[]>('/audit'),
    refetchInterval: 30_000,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (notificationId: number) =>
      apiFetch(`/notifications/${notificationId}/read`, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
