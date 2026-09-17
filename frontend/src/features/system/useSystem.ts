import { useQuery } from '@tanstack/react-query'

import { ApiError, apiFetch } from '@/api/client'
import type {
  AppDetail,
  AppEnv,
  AppHistory,
  AppState,
  AppStats,
  AppStorage,
  Diagnostics,
  Health,
  HostMetrics,
  SystemHealth,
  SystemSummary,
  Updates,
} from '@/api/types'

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

export function useAppHistory(app: string, kind: string | null) {
  const suffix = kind ? `?kind=${kind}` : ''
  return useQuery<AppHistory>({
    queryKey: ['apps', app, 'history', kind],
    queryFn: () => apiFetch<AppHistory>(`/apps/${app}/history${suffix}`),
  })
}

export function useAppStats(app: string) {
  return useQuery<AppStats>({
    queryKey: ['apps', app, 'stats'],
    queryFn: () => apiFetch<AppStats>(`/apps/${app}/stats`),
    refetchInterval: 15_000,
  })
}

export function useAppEnv(app: string) {
  return useQuery<AppEnv>({
    queryKey: ['apps', app, 'env'],
    queryFn: () => apiFetch<AppEnv>(`/apps/${app}/env`),
  })
}

export function useAppStorage(app: string) {
  return useQuery<AppStorage>({
    queryKey: ['apps', app, 'storage'],
    queryFn: () => apiFetch<AppStorage>(`/apps/${app}/storage`),
    refetchInterval: 120_000,
  })
}

export function useHealth() {
  return useQuery<Health>({
    queryKey: ['health'],
    queryFn: () => apiFetch<Health>('/health'),
    refetchInterval: 30_000,
  })
}

export function useSystemHealth() {
  return useQuery<SystemHealth>({
    queryKey: ['system', 'health'],
    queryFn: () => apiFetch<SystemHealth>('/system/health'),
    refetchInterval: 60_000,
  })
}

export function useMetrics() {
  return useQuery<HostMetrics>({
    queryKey: ['system', 'metrics'],
    queryFn: () => apiFetch<HostMetrics>('/system/metrics'),
    refetchInterval: 30_000,
  })
}

export function useUpdates() {
  return useQuery<Updates>({
    queryKey: ['updates'],
    queryFn: () => apiFetch<Updates>('/updates?refresh=true'),
    refetchInterval: 15 * 60_000,
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
