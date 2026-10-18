import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useEventStream } from '@/lib/useEventStream'

class FakeEventSource {
  static instances: FakeEventSource[] = []

  url: string
  onopen: ((event: Event) => void) | null = null
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

  emit(data: string, lastEventId = '') {
    this.onmessage?.(new MessageEvent('message', { data, lastEventId }))
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function buildUrl(after: string): string {
  return `/api/v1/notifications/events${after ? `?after=${after}` : ''}`
}

describe('useEventStream', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    FakeEventSource.instances = []
  })

  it('capte la trame « auth required » et prévient de la perte d’authentification', () => {
    vi.stubGlobal('EventSource', FakeEventSource)
    const onAuthLost = vi.fn()

    renderHook(() =>
      useEventStream({
        key: 'k',
        buildUrl,
        onMessage: vi.fn(),
        onAuthLost,
      }),
    )

    const source = FakeEventSource.instances[0]
    act(() => source.emit('{"auth":"required"}'))

    expect(onAuthLost).toHaveBeenCalledTimes(1)
    expect(source.closed).toBe(true)
  })

  it('arrête les reconnexions quand /auth/me renvoie 401', async () => {
    vi.stubGlobal('EventSource', FakeEventSource)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ detail: 'Non authentifié' }, 401)),
    )
    const onAuthLost = vi.fn()

    renderHook(() => useEventStream({ key: 'k', buildUrl, onMessage: vi.fn(), onAuthLost }))

    await act(async () => {
      await FakeEventSource.instances[0].onerror?.(new Event('error'))
    })

    expect(onAuthLost).toHaveBeenCalledTimes(1)
    expect(FakeEventSource.instances).toHaveLength(1)
  })

  it('reconnecte avec backoff et reprend après le dernier identifiant', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('EventSource', FakeEventSource)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ username: 'admin', internal_auth: true })),
    )
    const onMessage = vi.fn()

    renderHook(() => useEventStream({ key: 'k', buildUrl, onMessage }))

    const first = FakeEventSource.instances[0]
    act(() => first.emit('{"id":7}', '7'))
    expect(onMessage).toHaveBeenCalledWith('{"id":7}', '7')

    await act(async () => {
      first.onerror?.(new Event('error'))
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })

    expect(FakeEventSource.instances).toHaveLength(2)
    expect(FakeEventSource.instances[1].url).toContain('after=7')
  })
})
