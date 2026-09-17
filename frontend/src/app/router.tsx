import { createBrowserRouter, Navigate } from 'react-router-dom'

import { Layout } from '@/app/Layout'
import { AppDetailPage } from '@/features/apps/AppDetailPage'
import { AppsPage } from '@/features/apps/AppsPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { DiagnosticsPage } from '@/features/diagnostics/DiagnosticsPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'apps', element: <AppsPage /> },
      { path: 'apps/:app', element: <AppDetailPage /> },
      { path: 'diagnostics', element: <DiagnosticsPage /> },
    ],
  },
])
