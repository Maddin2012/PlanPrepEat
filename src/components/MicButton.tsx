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
 * Ein Mikrofonknopf, der Gesprochenes abschnittsweise weiterreicht.
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
  onChunk,
  once,
  small,
  className,
}: {
  /** Was diktiert wird, für die Beschriftung: „Zutaten", „Zubereitung" … */
  label: string
  /** Steht in der Leiste, solange zugehört wird. */
  hint?: string
  onChunk: (text: string) => void
  /**
   * Nach einem Satz von selbst aufhören.
   *
   * Für die Mikrofone direkt an einem Feld: Dort wird ein Wert diktiert, nicht
   * eine Liste. Ohne das liefe das Zuhören weiter, während man überlegt, was
   * als Nächstes hineinsoll — genau die Reibung, die es abstellen soll.
   */
  once?: boolean
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
   * Ohne das wird beim Start eingefroren, was `onChunk` gerade war — samt der
   * Liste, die es sich gemerkt hat. Jeder weitere Abschnitt hängte dann an
   * derselben alten Liste an, und am Ende überlebte nur die zuletzt gesprochene
   * Zutat. Genau so ist es beim ersten Durchlauf passiert.
   */
  const latest = useRef(onChunk)
  latest.current = onChunk

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

  function start() {
    setError(null)
    const started = startDictation({
      onChunk: (text) => {
        setInterim('')
        latest.current(text)
        // Gefahrlos von hier aus: `stop()` gibt zwar noch einmal ab, findet
        // den Puffer aber leer vor — es kommt also kein zweiter Abschnitt.
        // Den Rest erledigt `onStopped`.
        if (once) handle.current?.stop()
      },
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
        // Über allem und mit großer Fläche zum Beenden: Beim Diktieren hat man
        // das Gerät nicht vor der Nase, da muss der Stopp-Knopf blind treffbar
        // sein.
        <div className="fixed inset-x-3 bottom-3 z-50 rounded-2xl bg-overlay p-3 text-on-overlay shadow-2xl">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 animate-pulse items-center justify-center rounded-full bg-red-600">
              <MicIcon className="size-4.5" />
            </span>
            <p className="min-w-0 flex-1 text-sm leading-snug">
              {interim || (
                <span className="text-on-overlay/60">
                  {hint ?? `${label} — sprich einfach los.`}
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={stop}
              className="shrink-0 rounded-xl bg-on-overlay/15 px-4 py-2 text-sm font-medium active:bg-on-overlay/25"
            >
              Fertig
            </button>
          </div>
        </div>
      )}
    </>
  )
}
