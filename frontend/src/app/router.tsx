import { lazy } from 'react'
import type { ComponentType } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'

import { Layout } from '@/app/Layout'

function lazyPage<T extends Record<string, ComponentType>>(
  loader: () => Promise<T>,
  name: keyof T,
) {
  return lazy(async () => {
    const module = await loader()
    return { default: module[name] }
  })
}

const AppDetailPage = lazyPage(() => import('@/features/apps/AppDetailPage'), 'AppDetailPage')
const AppHistoryPage = lazyPage(() => import('@/features/apps/AppHistoryPage'), 'AppHistoryPage')
const AppsPage = lazyPage(() => import('@/features/apps/AppsPage'), 'AppsPage')
const AuditPage = lazyPage(() => import('@/features/audit/AuditPage'), 'AuditPage')
const AuthAppsPage = lazyPage(() => import('@/features/auth/AuthAppsPage'), 'AuthAppsPage')
const BackupsPage = lazyPage(() => import('@/features/backups/BackupsPage'), 'BackupsPage')
const LoginPage = lazyPage(() => import('@/features/auth/LoginPage'), 'LoginPage')
const DashboardPage = lazyPage(() => import('@/features/dashboard/DashboardPage'), 'DashboardPage')
const DiagnosticsPage = lazyPage(
  () => import('@/features/diagnostics/DiagnosticsPage'),
  'DiagnosticsPage',
)
const HealthPage = lazyPage(() => import('@/features/health/HealthPage'), 'HealthPage')
const JobsPage = lazyPage(() => import('@/features/jobs/JobsPage'), 'JobsPage')
const NotificationsPage = lazyPage(
  () => import('@/features/notifications/NotificationsPage'),
  'NotificationsPage',
)
const SettingsPage = lazyPage(() => import('@/features/settings/SettingsPage'), 'SettingsPage')
const SetupPage = lazyPage(() => import('@/features/setup/SetupPage'), 'SetupPage')
const UpdatesPage = lazyPage(() => import('@/features/updates/UpdatesPage'), 'UpdatesPage')

export const router = createBrowserRouter([
  { path: '/setup', element: <SetupPage /> },
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'apps', element: <AppsPage /> },
      { path: 'apps/:app', element: <AppDetailPage /> },
      { path: 'apps/:app/history', element: <AppHistoryPage /> },
      { path: 'jobs', element: <JobsPage /> },
      { path: 'jobs/:id', element: <JobsPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'audit', element: <AuditPage /> },
      { path: 'health', element: <HealthPage /> },
      { path: 'backups', element: <BackupsPage /> },
      { path: 'updates', element: <UpdatesPage /> },
      { path: 'auth', element: <AuthAppsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'diagnostics', element: <DiagnosticsPage /> },
    ],
  },
])
