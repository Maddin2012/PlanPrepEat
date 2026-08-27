import { useEffect, useState, type ReactNode } from 'react'
import { speakableText } from '../../domain/speakable.ts'
import { startReading, useGermanVoice } from '../../lib/reading.ts'
import { Button, cx } from '../../components/ui.tsx'
import {
  CloseIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  SpeakerIcon,
} from '../../components/Icons.tsx'

/**
 * Die Zubereitung — zum Lesen und zum Vorlesenlassen.
 *
 * Beim Kochen hat man Teig an den Fingern und das Gerät zwei Schritte weiter.
 * Deshalb liest die App die Schritte der Reihe nach vor und **geht von selbst
 * weiter**; anhalten und zurückspringen kostet einen Tipp. Der Schritt, der
 * gerade gelesen wird, ist hervorgehoben und rückt von selbst ins Bild.
 *
 * Ohne deutsche Stimme erscheint der Knopf gar nicht — genau wie beim Mikrofon.
 * Den Bildschirm anlassen tut die App weiterhin nicht; das hatten wir und haben
 * es auf Wunsch wieder ausgebaut.
 */
export default function StepReader({ steps }: { steps: string[] }) {
  const hatStimme = useGermanVoice()
  const [aktiv, setAktiv] = useState<number | null>(null)
  const [pausiert, setPausiert] = useState(false)

  // Der zu lesende Text und die Anzahl — **einfache Werte**, keine Liste. Die
  // Liste wird bei jedem Zeichnen neu gebaut; hinge der Vorgang unten an ihr,
  // bräche er sich bei jedem Zeichnen selbst ab und finge von vorn an.
  const text = aktiv === null ? '' : (steps[aktiv] ?? '')
  const anzahl = steps.length

  /**
   * Der eigentliche Vorlesevorgang.
   *
   * Er hängt nur an Schritt und Pausenzustand: Jede Änderung bricht das Alte ab
   * und fängt das Neue an. Dadurch sind „weiter", „zurück" und „von vorn" ein
   * und dieselbe Sache — eine andere Zahl im Zustand.
   */
  useEffect(() => {
    if (aktiv === null || pausiert) return

    const handle = startReading(speakableText(text), {
      // Der nächste Schritt, oder Schluss. Der Index kommt aus dem Abschluss
      // und nicht aus einer Vorschrift `(x) => x + 1`: Die liefe erst später,
      // und dann wäre nicht mehr sicher, welcher Schritt gemeint war.
      onEnd: () => setAktiv(aktiv + 1 < anzahl ? aktiv + 1 : null),
      onError: () => setAktiv(null),
    })

    if (!handle) {
      setAktiv(null)
      return
    }
    return () => handle.cancel()
  }, [aktiv, pausiert, text, anzahl])

  function starten() {
    setPausiert(false)
    setAktiv(0)
  }

  function beenden() {
    setAktiv(null)
    setPausiert(false)
  }

  function springen(zu: number) {
    if (zu < 0 || zu >= steps.length) return
    setPausiert(false)
    setAktiv(zu)
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-ink-600">Zubereitung</h2>
        {hatStimme && aktiv === null && (
          <Button
            variant="secondary"
            className="min-h-9 px-3 text-sm"
            onClick={starten}
          >
            <SpeakerIcon className="size-4.5 shrink-0" />
            Vorlesen
          </Button>
        )}
      </div>

      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li
            key={index}
            // Nicht nur eingefärbt, sondern auch benannt: Wer sich die Seite
            // vorlesen lässt, hört sonst nicht, welcher Schritt gemeint ist.
            aria-current={index === aktiv ? 'step' : undefined}
            ref={(element) => {
              // Der gelesene Schritt rückt von selbst ins Bild — sonst müsste
              // man ihn mit teigigen Fingern suchen.
              if (index === aktiv) {
                element?.scrollIntoView({ block: 'center', behavior: 'smooth' })
              }
            }}
            className={cx(
              'flex gap-3 rounded-2xl p-4 ring-1 transition-colors',
              index === aktiv
                ? 'bg-accent-soft ring-accent'
                : 'bg-surface ring-clay-200',
            )}
          >
            <span
              className={cx(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                index === aktiv
                  ? 'bg-accent text-on-accent'
                  : 'bg-accent-soft text-accent-text',
              )}
            >
              {index + 1}
            </span>
            <p className="min-w-0 flex-1 leading-relaxed text-ink-900">{step}</p>
          </li>
        ))}
      </ol>

      {aktiv !== null && (
        // Über allem und mit großen Flächen: Beim Kochen wird blind getippt.
        <div className="fixed inset-x-3 bottom-3 z-50 rounded-2xl bg-overlay p-3 text-on-overlay shadow-2xl">
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 pl-1 text-sm">
              Schritt {aktiv + 1} von {steps.length}
              {pausiert && <span className="text-on-overlay/60"> · angehalten</span>}
            </span>

            <BarButton
              label="Voriger Schritt"
              disabled={aktiv === 0}
              onClick={() => springen(aktiv - 1)}
            >
              <PrevIcon className="size-5" />
            </BarButton>

            <BarButton
              label={pausiert ? 'Weiterlesen' : 'Anhalten'}
              onClick={() => setPausiert(!pausiert)}
            >
              {pausiert ? (
                <PlayIcon className="size-5" />
              ) : (
                <PauseIcon className="size-5" />
              )}
            </BarButton>

            <BarButton
              label="Nächster Schritt"
              disabled={aktiv + 1 >= steps.length}
              onClick={() => springen(aktiv + 1)}
            >
              <NextIcon className="size-5" />
            </BarButton>

            <BarButton label="Vorlesen beenden" onClick={beenden}>
              <CloseIcon className="size-5" />
            </BarButton>
          </div>

          {pausiert && (
            <p className="mt-2 pl-1 text-xs text-on-overlay/60">
              Weiter geht es am Anfang dieses Schritts.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

function BarButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-on-overlay/15 active:bg-on-overlay/25 disabled:opacity-30"
    >
      {children}
    </button>
  )
}
