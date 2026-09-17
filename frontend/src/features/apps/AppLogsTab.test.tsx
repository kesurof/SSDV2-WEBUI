import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppLogsTab } from '@/features/apps/AppLogsTab'

function renderTab(app: string, containers: string[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AppLogsTab app={app} containers={containers} />
    </QueryClientProvider>,
  )
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('AppLogsTab', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders logs of the default container', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ app: 'sonarr', container: 'sonarr', lines: ['ligne 1', 'ligne 2'] }),
    )
    vi.stubGlobal('fetch', fetchMock)

    renderTab('sonarr', ['sonarr', 'db-sonarr'])

    await waitFor(() => expect(screen.getByText(/ligne 1/)).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/apps/sonarr/logs?container=sonarr&lines=200',
      expect.anything(),
    )
  })

  it('fetches the selected container', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (url: string) =>
      jsonResponse({
        app: 'sonarr',
        container: url.includes('db-sonarr') ? 'db-sonarr' : 'sonarr',
        lines: [url.includes('db-sonarr') ? 'ligne db' : 'ligne principale'],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    renderTab('sonarr', ['sonarr', 'db-sonarr'])

    await user.selectOptions(screen.getByLabelText('Conteneur'), 'db-sonarr')

    await waitFor(() => expect(screen.getByText(/ligne db/)).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('container=db-sonarr'),
      expect.anything(),
    )
  })
})
