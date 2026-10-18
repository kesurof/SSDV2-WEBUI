import { useEffect, useRef } from 'react'

import { apiUrl } from '@/api/url'

type EventStreamOptions = {
  /** Change cette clé pour (re)souscrire au flux. */
  key: string | null
  /** Construit l'URL en reprenant après le dernier identifiant reçu. */
  buildUrl: (after: string) => string
  onMessage: (data: string, lastId: string) => void
  /** Appelé quand l'authentification est perdue (arrêt des reconnexions). */
  onAuthLost?: () => void
  enabled?: boolean
}

const MAX_BACKOFF_MS = 30_000
const STABLE_OPEN_MS = 5_000

/**
 * Flux SSE avec reconnexion contrôlée.
 *
 * L'API EventSource n'expose pas le code HTTP : en cas d'erreur, on ferme le flux,
 * on interroge `/auth/me`, puis on décide de reconnecter (avec backoff) ou d'arrêter.
 * La reprise via `?after=<lastEventId>` évite les doublons après reconnexion.
 */
export function useEventStream({
  key,
  buildUrl,
  onMessage,
  onAuthLost,
  enabled = true,
}: EventStreamOptions) {
  const buildUrlRef = useRef(buildUrl)
  const onMessageRef = useRef(onMessage)
  const onAuthLostRef = useRef(onAuthLost)

  useEffect(() => {
    buildUrlRef.current = buildUrl
    onMessageRef.current = onMessage
    onAuthLostRef.current = onAuthLost
  })

  useEffect(() => {
    if (!key || !enabled) return

    let source: EventSource | null = null
    let closed = false
    let attempts = 0
    let lastId = ''
    let openedAt = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    // Les proxies externes peuvent renvoyer un écran HTML de connexion en HTTP 200.
    // Une panne réseau/serveur n'est en revanche PAS une déconnexion.
    async function checkAuthentication(): Promise<'ok' | 'lost' | 'retry'> {
      try {
        const response = await fetch(apiUrl('/auth/me'), {
          credentials: 'include',
          cache: 'no-store',
        })
        if (response.status === 401 || response.status === 403) return 'lost'
        if (!response.ok) return 'retry'
        if (!response.headers.get('content-type')?.includes('application/json')) return 'lost'
        const body: unknown = await response.json()
        if (typeof body !== 'object' || body === null) return 'retry'
        if (!('username' in body) || typeof body.username !== 'string') return 'lost'
        return 'ok'
      } catch {
        return 'retry'
      }
    }

    function connect() {
      if (closed) return
      source = new EventSource(buildUrlRef.current(lastId))
      source.onopen = () => {
        openedAt = Date.now()
        attempts = 0
      }
      source.onmessage = (event) => {
        if (event.data.includes('"auth":"required"')) {
          source?.close()
          source = null
          onAuthLostRef.current?.()
          return
        }
        if (event.lastEventId) lastId = event.lastEventId
        onMessageRef.current(event.data, lastId)
      }
      source.onerror = async () => {
        source?.close()
        source = null
        if (closed) return
        // Connexion stable interrompue (ex. durée maximale) : reconnexion rapide.
        if (openedAt && Date.now() - openedAt >= STABLE_OPEN_MS) attempts = 0
        const auth = await checkAuthentication()
        if (closed) return
        if (auth === 'lost') {
          onAuthLostRef.current?.()
          return
        }
        attempts += 1
        const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.min(attempts - 1, 5))
        timer = setTimeout(connect, delay)
      }
    }

    connect()
    return () => {
      closed = true
      source?.close()
      if (timer) clearTimeout(timer)
    }
  }, [key, enabled])
}
