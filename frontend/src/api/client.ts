import { apiUrl } from '@/api/url'

export class ApiError extends Error {
  status: number
  code: 'http' | 'non_json'

  constructor(status: number, message: string, code: 'http' | 'non_json' = 'http') {
    super(message)
    this.status = status
    this.code = code
  }
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function formatFieldLocation(loc: unknown): string {
  if (!Array.isArray(loc)) {
    return ''
  }
  return loc
    .filter((part) => part !== 'body' && part !== 'query' && part !== 'path')
    .map((part) => String(part))
    .join('.')
}

// FastAPI renvoie soit `detail` sous forme de chaîne, soit une liste d'erreurs de
// validation Pydantic `[{ loc, msg, type }]` (notamment pour les 422).
function readErrorMessage(detail: unknown): string | null {
  if (typeof detail === 'string') {
    return detail
  }
  if (!Array.isArray(detail)) {
    return null
  }
  const messages = detail.flatMap((item) => {
    if (item === null || typeof item !== 'object') {
      return []
    }
    const { loc, msg } = item as { loc?: unknown; msg?: unknown }
    if (typeof msg !== 'string' || msg === '') {
      return []
    }
    const field = formatFieldLocation(loc)
    return [field ? `${field} : ${msg}` : msg]
  })
  return messages.length > 0 ? messages.join(' ; ') : null
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const method = (init.method ?? 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') {
    const csrf = readCookie('ssdv2_webui_csrf')
    if (csrf) headers.set('x-csrf-token', csrf)
    if (init.body) headers.set('content-type', 'application/json')
  }

  const response = await fetch(apiUrl(path), {
    ...init,
    headers,
    credentials: 'include',
  })

  // Certains proxies (oauth2-proxy, Authelia) répondent en HTML — parfois avec un
  // HTTP 200 — lorsqu'ils demandent une reconnexion. On ne recharge jamais ici :
  // cela provoquerait une boucle ; on expose une erreur explicite.
  const contentType = response.headers?.get('content-type') ?? ''
  if (response.status !== 204 && contentType && !contentType.includes('application/json')) {
    throw new ApiError(
      response.status,
      'Le serveur a renvoyé une page ou un contenu non-JSON. Vérifiez la connexion externe et les règles du reverse proxy.',
      'non_json',
    )
  }

  if (!response.ok) {
    let message = response.statusText
    const body: unknown = await response.json().catch(() => null)
    if (body !== null && typeof body === 'object' && 'detail' in body) {
      message = readErrorMessage((body as { detail: unknown }).detail) ?? message
    }
    throw new ApiError(response.status, message)
  }

  if (response.status === 204) {
    return undefined as T
  }
  try {
    return (await response.json()) as T
  } catch {
    throw new ApiError(
      response.status,
      'La réponse du serveur n’est pas un JSON valide. Vérifiez la configuration du proxy.',
      'non_json',
    )
  }
}
