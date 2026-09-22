import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppLogsTab } from '@/features/apps/AppLogsTab'

class FakeEventSource {
  static instances: FakeEventSource[] = []

  url: string
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  closed = false

  constructor(url: string) {
    this.url = url
    FakeEventSource.instances.push(this)
  }

  close() {
    this.closed = true
  }

  emit(payload: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(payload) }))
  }
}

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
    FakeEventSource.instances = []
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

  it('streams logs while following', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ app: 'sonarr', container: 'sonarr', lines: [] })),
    )
    vi.stubGlobal('EventSource', FakeEventSource)

    renderTab('sonarr', ['sonarr'])
    await user.click(screen.getByRole('button', { name: 'Suivre en direct' }))

    const source = FakeEventSource.instances[0]
    expect(source.url).toContain('/api/v1/apps/sonarr/logs/stream?container=sonarr&lines=200')

    act(() => source.emit({ line: 'ligne directe 1' }))
    act(() => source.emit({ line: 'ligne directe 2' }))
    expect(screen.getByText(/ligne directe 1/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Arrêter le suivi' }))
    expect(source.closed).toBe(true)
  })

  it('filters displayed logs with the search field', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          app: 'sonarr',
          container: 'sonarr',
          lines: ['ligne alpha', 'ligne beta'],
        }),
      ),
    )

    renderTab('sonarr', ['sonarr'])
    await waitFor(() => expect(screen.getByText(/ligne alpha/)).toBeInTheDocument())

    await user.type(screen.getByLabelText('Rechercher dans les logs…'), 'beta')

    expect(screen.queryByText(/ligne alpha/)).not.toBeInTheDocument()
    expect(screen.getByText(/ligne beta/)).toBeInTheDocument()
  })

  it('pauses the live display and resumes with buffered lines', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ app: 'sonarr', container: 'sonarr', lines: [] })),
    )
    vi.stubGlobal('EventSource', FakeEventSource)

    renderTab('sonarr', ['sonarr'])
    await user.click(screen.getByRole('button', { name: 'Suivre en direct' }))
    const source = FakeEventSource.instances[0]

    act(() => source.emit({ line: 'avant pause' }))
    expect(screen.getByText(/avant pause/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Pause' }))
    act(() => source.emit({ line: 'après pause' }))
    expect(screen.queryByText(/après pause/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reprendre' }))
    expect(screen.getByText(/après pause/)).toBeInTheDocument()
  })

  it('copies the displayed logs', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ app: 'sonarr', container: 'sonarr', lines: ['ligne à copier'] }),
      ),
    )
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    renderTab('sonarr', ['sonarr'])
    await waitFor(() => expect(screen.getByText(/ligne à copier/)).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Copier' }))

    expect(writeText).toHaveBeenCalledWith('ligne à copier')
  })

  it('downloads the displayed logs', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ app: 'sonarr', container: 'sonarr', lines: ['ligne à exporter'] }),
      ),
    )
    const createObjectURL = vi.fn(() => 'blob:logs')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true })

    renderTab('sonarr', ['sonarr'])
    await waitFor(() => expect(screen.getByText(/ligne à exporter/)).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Télécharger' }))

    expect(createObjectURL).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:logs')
  })
})
