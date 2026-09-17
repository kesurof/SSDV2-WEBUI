import { createBrowserRouter, Navigate } from 'react-router-dom'

import { Layout } from '@/app/Layout'
import { AppsPage } from '@/features/apps/AppsPage'
import { LoginPage } from '@/features/auth/LoginPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/apps" replace /> },
      { path: 'apps', element: <AppsPage /> },
    ],
  },
])
