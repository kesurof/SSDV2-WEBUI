import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiFetch } from '@/api/client'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('apiFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('surfaces a string detail verbatim', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ detail: 'Non authentifié' }, 401)))

    await expect(apiFetch('/x')).rejects.toMatchObject({
      status: 401,
      message: 'Non authentifié',
    })
  })

  it('formats a FastAPI validation detail list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          {
            detail: [
              {
                loc: ['body', 'username'],
                msg: 'String should match pattern',
                type: 'string_pattern_mismatch',
              },
              {
                loc: ['body', 'password'],
                msg: 'String should have at least 12 characters',
                type: 'string_too_short',
              },
            ],
          },
          422,
        ),
      ),
    )

    const error = await apiFetch('/setup', { method: 'POST', body: '{}' }).catch(
      (e) => e as ApiError,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 422,
      message:
        'username : String should match pattern ; password : String should have at least 12 characters',
    })
  })

  it('keeps statusText when no detail is provided', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'boom' }, 500)))

    const error = await apiFetch('/x').catch((e) => e as ApiError)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 500 })
  })

  it('détecte une page HTML de proxy (reconnexion) sans la parser en JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('<!doctype html><title>Sign in</title>', {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          }),
      ),
    )

    const error = await apiFetch('/x').catch((e) => e as ApiError)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 200, code: 'non_json' })
  })
})
