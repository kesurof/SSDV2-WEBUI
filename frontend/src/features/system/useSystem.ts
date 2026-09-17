import { useQuery } from '@tanstack/react-query'

import { ApiError, apiFetch } from '@/api/client'
import type { AppDetail, AppState, Diagnostics, Health, SystemSummary } from '@/api/types'

export function useApps() {
  return useQuery<AppState[]>({
    queryKey: ['apps'],
    queryFn: () => apiFetch<AppState[]>('/apps'),
    refetchInterval: 30_000,
  })
}

export function useApp(app: string) {
  return useQuery<AppDetail>({
    queryKey: ['apps', app],
    queryFn: () => apiFetch<AppDetail>(`/apps/${app}`),
    refetchInterval: 30_000,
    retry: (failureCount, error) => !(error instanceof ApiError && error.status === 404) && failureCount < 2,
  })
}

export function useHealth() {
  return useQuery<Health>({
    queryKey: ['health'],
    queryFn: () => apiFetch<Health>('/health'),
    refetchInterval: 30_000,
  })
}

export function useDiagnostics() {
  return useQuery<Diagnostics>({
    queryKey: ['diagnostics'],
    queryFn: () => apiFetch<Diagnostics>('/diagnostics'),
    refetchInterval: 60_000,
  })
}

export function useSummary() {
  return useQuery<SystemSummary>({
    queryKey: ['summary'],
    queryFn: () => apiFetch<SystemSummary>('/system/summary'),
    refetchInterval: 30_000,
  })
}
