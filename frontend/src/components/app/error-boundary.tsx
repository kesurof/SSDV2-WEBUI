import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { fr } from '@/i18n/fr'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erreur non gérée', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-svh place-items-center p-6">
          <Alert variant="destructive" className="max-w-lg">
            <AlertTitle>{fr.common.error}</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{this.state.error.message}</p>
              <Button
                variant="outline"
                onClick={() => {
                  this.setState({ error: null })
                  window.location.reload()
                }}
              >
                {fr.common.retry}
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )
    }
    return this.props.children
  }
}
