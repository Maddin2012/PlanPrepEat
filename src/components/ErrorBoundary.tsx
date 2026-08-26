import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './ui.tsx'

interface Props {
  children: ReactNode
  /** Wechselt dieser Wert, wird ein aufgefangener Fehler zurückgesetzt. */
  resetKey?: string
  /**
   * Was statt der ganzseitigen Meldung erscheinen soll.
   *
   * Für abgeschottete Teile: Ein abgestürztes Blatt soll nicht die Seite
   * darunter durch eine Fehlerseite ersetzen — es soll schlicht verschwinden,
   * und die Seite sagt selbst, was los ist. `null` ist dafür der Normalfall.
   */
  fallback?: ReactNode
  /** Wird einmal beim Auffangen gerufen — zum Aufräumen ringsherum. */
  onError?: (error: Error) => void
}

interface State {
  error: Error | null
}

/**
 * Fängt Fehler beim Rendern ab.
 *
 * Ohne das reißt ein einziger Fehler den kompletten Baum ab: Der Bildschirm
 * wird weiß, und weil auch die Reiterleiste weg ist, kommt man nicht einmal
 * mehr zurück auf eine andere Seite. Genau das ist mit einem alten
 * gespeicherten Stand passiert. Hier bleibt wenigstens ein Weg heraus —
 * und die Fehlermeldung steht sichtbar da, statt nur in der Entwicklerkonsole.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Fehler beim Rendern:', error, info.componentStack)
    this.props.onError?.(error)
  }

  componentDidUpdate(previous: Props): void {
    // Beim Wechsel auf eine andere Seite neu versuchen — sonst bliebe die
    // Meldung stehen, obwohl der kaputte Teil längst verlassen wurde.
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback !== undefined) return this.props.fallback

    return (
      <div className="flex flex-col items-center px-8 py-16 text-center">
        <h1 className="text-lg font-semibold text-ink-900">
          Hier ist etwas schiefgegangen
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-500">
          Diese Seite konnte nicht angezeigt werden. Die anderen Reiter unten
          funktionieren weiter.
        </p>

        <pre className="mt-4 max-w-full overflow-x-auto rounded-xl bg-clay-100 p-3 text-left text-xs text-ink-600">
          {error.message}
        </pre>

        <div className="mt-6 flex gap-2">
          <Button onClick={() => this.setState({ error: null })}>
            Noch mal versuchen
          </Button>
          <Button variant="secondary" onClick={() => location.reload()}>
            App neu laden
          </Button>
        </div>
      </div>
    )
  }
}
