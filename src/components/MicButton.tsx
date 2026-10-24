import { useEffect, useRef, useState } from 'react'
import {
  isDictationAvailable,
  startDictation,
  type DictationError,
  type DictationHandle,
} from '../lib/speech.ts'
import { MicIcon } from './Icons.tsx'
import { cx } from './ui.tsx'

const MESSAGES: Record<DictationError, string> = {
  denied: 'Die App darf das Mikrofon nicht benutzen. In den Browsereinstellungen erlauben.',
  offline: 'Zum Diktieren braucht das Gerät Internet.',
  other: 'Das Zuhören hat nicht geklappt.',
}

/**
 * Ein Mikrofonknopf, der Gesprochenes weiterreicht — **Grenzen setzt der
 * Mensch.**
 *
 * Vorher galt ein Abschnitt nach einer Sprechpause von 1,2 Sekunden als fertig
 * und wurde zur nächsten Zutat. Wer beim Sprechen überlegt, bekam daraus zwei.
 * Jetzt wird gesammelt, bis auf „Fertig" oder — wo es mehrere Einträge gibt —
 * auf „Nächste Zutat" getippt wird.
 *
 * Er ersetzt nichts: Die Felder daneben bleiben ganz normal tippbar, und wer
 * lieber die Mikrofontaste seiner Tastatur benutzt, kann das weiterhin tun.
 * Kann das Gerät nicht zuhören — Firefox etwa kennt die Schnittstelle gar
 * nicht —, erscheint der Knopf erst gar nicht, statt beim Tippen ins Leere zu
 * laufen.
 */
export function MicButton({
  label,
  hint,
  onItem,
  nextLabel,
  small,
  className,
}: {
  /** Was diktiert wird, für die Beschriftung: „Zutaten", „Zubereitung" … */
  label: string
  /** Steht in der Leiste, solange zugehört wird. */
  hint?: string
  onItem: (text: string) => void
  /**
   * Beschriftung für den Knopf, der einen Eintrag abschließt und den nächsten
   * anfängt — etwa „Nächste Zutat".
   *
   * Fehlt er, gibt es nur „Fertig". Das ist der Fall für die Mikrofone direkt
   * an einem Feld: Dort wird **ein** Wert diktiert, keine Liste.
   */
  nextLabel?: string
  /** Schmalere Bauform für die Mikrofone in einer Zeile. */
  small?: boolean
  className?: string
}) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const handle = useRef<DictationHandle | null>(null)

  /**
   * Immer der neueste Rückruf.
   *
   * Ohne das wird beim Start eingefroren, was `onItem` gerade war — samt der
   * Liste, die es sich gemerkt hat. Jeder weitere Eintrag hängte dann an
   * derselben alten Liste an, und am Ende überlebte nur die zuletzt gesprochene
   * Zutat. Genau so ist es beim ersten Durchlauf passiert.
   */
  const latest = useRef(onItem)
  latest.current = onItem

  // Beim Verlassen der Seite das Mikrofon loslassen — sonst hört es weiter zu,
  // während man längst woanders ist.
  useEffect(() => {
    return () => handle.current?.stop()
  }, [])

  // Die Wortlisten werden erst beim Rendern gefragt, damit serverseitiges
  // Rendern und Tests ohne `window` nicht darüber stolpern.
  if (!isDictationAvailable()) return null

  function stop() {
    handle.current?.stop()
    handle.current = null
    setListening(false)
    setInterim('')
  }

  /** Eintrag abschließen und weiter zuhören. */
  function next() {
    handle.current?.next()
    setInterim('')
  }

  function start() {
    setError(null)
    const started = startDictation({
      onItem: (text) => latest.current(text),
      onInterim: setInterim,
      onError: (kind) => setError(MESSAGES[kind]),
      onStopped: () => {
        handle.current = null
        setListening(false)
        setInterim('')
      },
    })

    if (!started) {
      setError(MESSAGES.other)
      return
    }
    handle.current = started
    setListening(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => (listening ? stop() : start())}
        aria-label={listening ? `${label} — Diktat beenden` : `${label} diktieren`}
        aria-pressed={listening}
        className={cx(
          'flex shrink-0 items-center justify-center rounded-full transition-colors',
          small ? 'size-8' : 'size-9',
          listening
            ? 'animate-pulse bg-red-600 text-white'
            : 'bg-clay-100 text-ink-500 active:bg-clay-200',
          className,
        )}
      >
        <MicIcon className={small ? 'size-4' : 'size-4.5'} />
      </button>

      {error && (
        <p className="mt-1 basis-full text-xs leading-relaxed text-red-600">
          {error}
        </p>
      )}

      {listening && (
        // Über allem und mit großen Flächen: Beim Diktieren hat man das Gerät
        // nicht vor der Nase, da müssen die Knöpfe blind treffbar sein.
        <div className="fixed inset-x-3 bottom-3 z-50 rounded-2xl bg-overlay p-3 text-on-overlay shadow-2xl">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 animate-pulse items-center justify-center rounded-full bg-red-600">
              <MicIcon className="size-4.5" />
            </span>
            {/* Der **ganze** gesammelte Text, nicht nur das letzte Stück: Man
                muss sehen, was am Ende in der Zeile landet. */}
            <p className="min-w-0 flex-1 py-1.5 text-sm leading-snug">
              {interim || (
                <span className="text-on-overlay/60">
                  {hint ??
                    (nextLabel
                      ? `${label} — sprich los. Mit „${nextLabel}" fängst du den nächsten an.`
                      : `${label} — sprich los, dann „Fertig".`)}
                </span>
              )}
            </p>
          </div>

          <div className="mt-2.5 flex gap-2">
            {nextLabel && (
              <button
                type="button"
                onClick={next}
                className="min-h-11 flex-1 rounded-xl bg-on-overlay/15 px-3 text-sm font-medium active:bg-on-overlay/25"
              >
                {nextLabel}
              </button>
            )}
            <button
              type="button"
              onClick={stop}
              className={cx(
                'min-h-11 rounded-xl bg-on-overlay/15 px-4 text-sm font-medium active:bg-on-overlay/25',
                nextLabel ? 'shrink-0' : 'flex-1',
              )}
            >
              Fertig
            </button>
          </div>
        </div>
      )}
    </>
  )
}
