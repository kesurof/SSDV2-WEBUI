import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'

import { router } from '@/app/router'
import { PageSkeleton } from '@/components/app/page-skeleton'
import { ThemeProvider } from '@/components/app/theme-provider'
import { Toaster } from '@/components/ui/sonner'

import '@/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
})

const rootElement = document.getElementById('root')
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="ssdv2-theme">
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={<PageSkeleton />}>
            <RouterProvider router={router} />
          </Suspense>
          <Toaster />
        </QueryClientProvider>
      </ThemeProvider>
    </StrictMode>,
  )
}
