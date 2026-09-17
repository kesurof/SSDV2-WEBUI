import { createBrowserRouter, Navigate } from 'react-router-dom'

import { Layout } from '@/app/Layout'
import { AppDetailPage } from '@/features/apps/AppDetailPage'
import { AppHistoryPage } from '@/features/apps/AppHistoryPage'
import { AppsPage } from '@/features/apps/AppsPage'
import { AuditPage } from '@/features/audit/AuditPage'
import { AuthAppsPage } from '@/features/auth/AuthAppsPage'
import { BackupsPage } from '@/features/backups/BackupsPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { DiagnosticsPage } from '@/features/diagnostics/DiagnosticsPage'
import { HealthPage } from '@/features/health/HealthPage'
import { JobsPage } from '@/features/jobs/JobsPage'
import { NotificationsPage } from '@/features/notifications/NotificationsPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { SetupPage } from '@/features/setup/SetupPage'
import { UpdatesPage } from '@/features/updates/UpdatesPage'

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
