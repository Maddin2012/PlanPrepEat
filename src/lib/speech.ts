/**
 * Diktat über die Spracherkennung des Browsers.
 *
 * Das ist die eingebaute Web-Speech-Schnittstelle — kein Schlüssel, kein
 * Server, keine laufenden Kosten. Chrome schickt den Ton allerdings zu Google,
 * also braucht es Internet; ohne Netz passiert schlicht nichts. Firefox kennt
 * die Schnittstelle gar nicht, deshalb muss jede Stelle, die sie benutzt, mit
 * `isDictationAvailable()` vorher fragen und den Knopf sonst weglassen.
 */

/**
 * Eigene, absichtlich knappe Typen: Je nach TypeScript-Fassung fehlen die
 * Web-Speech-Typen in lib.dom oder heißen anders. Hier steht nur, was wir
 * tatsächlich anfassen.
 */
interface RecognitionAlternative {
  transcript: string
}

interface RecognitionResult {
  isFinal: boolean
  0: RecognitionAlternative
}

interface RecognitionEvent {
  resultIndex: number
  results: { length: number; [index: number]: RecognitionResult }
}

interface RecognitionErrorEvent {
  error: string
}

interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: ((event: RecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

type RecognitionConstructor = new () => Recognition

function constructor(): RecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const scope = window as unknown as Record<string, unknown>
  const found = scope.SpeechRecognition ?? scope.webkitSpeechRecognition
  return (found as RecognitionConstructor | undefined) ?? null
}

/** Kann dieses Gerät überhaupt zuhören? */
export function isDictationAvailable(): boolean {
  return constructor() !== null
}

export type DictationError = 'denied' | 'offline' | 'other'

export interface DictationHandle {
  /** Beendet das Zuhören. Mehrfach aufzurufen ist harmlos. */
  stop(): void
}

export interface DictationOptions {
  /** Ein fertig erkannter Abschnitt — in der Regel ein Satz je Sprechpause. */
  onChunk: (text: string) => void
  /** Was gerade gehört wird, noch nicht endgültig. */
  onInterim?: (text: string) => void
  onError?: (kind: DictationError) => void
  /** Wird genau einmal gerufen, wenn nicht mehr zugehört wird. */
  onStopped?: () => void
}

/**
 * Startet das Zuhören. Gibt `null` zurück, wenn das Gerät nicht mitspielt.
 *
 * Zwei Eigenheiten von Android werden hier abgefangen:
 *
 * 1. Trotz `continuous` hört Chrome nach einer Sprechpause von selbst auf. Wer
 *    ein Rezept diktiert, macht aber genau solche Pausen. Deshalb wird nach
 *    jedem Ende neu gestartet, bis der Benutzer wirklich auf Stopp drückt.
 * 2. Ein sofortiger Neustart im `onend`-Aufruf wirft „InvalidStateError". Der
 *    Umweg über einen Zeitgeber vermeidet das.
 */
export function startDictation(options: DictationOptions): DictationHandle | null {
  const Recognition = constructor()
  if (!Recognition) return null

  const recognition = new Recognition()
  recognition.lang = 'de-DE'
  recognition.continuous = true
  recognition.interimResults = true

  let stopped = false
  let restarts = 0

  function finish() {
    if (stopped) return
    stopped = true
    options.onStopped?.()
  }

  recognition.onresult = (event) => {
    let interim = ''
    for (let index = event.resultIndex; index < event.results.length; index++) {
      const result = event.results[index]
      const text = result[0]?.transcript ?? ''
      if (result.isFinal) {
        const trimmed = text.trim()
        if (trimmed) options.onChunk(trimmed)
      } else {
        interim += text
      }
    }
    options.onInterim?.(interim.trim())
  }

  recognition.onerror = (event) => {
    // „no-speech" und „aborted" sind keine Fehler, sondern der Normalfall beim
    // Nachdenken bzw. beim Stoppen — die dürfen den Lauf nicht abbrechen.
    if (event.error === 'no-speech' || event.error === 'aborted') return

    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      stopped = true
      options.onError?.('denied')
      options.onStopped?.()
      return
    }

    stopped = true
    options.onError?.(event.error === 'network' ? 'offline' : 'other')
    options.onStopped?.()
  }

  recognition.onend = () => {
    if (stopped) return
    // Zu viele Neustarts hintereinander heißt: Es kommt nichts mehr: lieber
    // aufhören als in einer Schleife zu stehen.
    if (restarts >= 60) {
      finish()
      return
    }
    restarts += 1
    window.setTimeout(() => {
      if (stopped) return
      try {
        recognition.start()
      } catch {
        finish()
      }
    }, 250)
  }

  try {
    recognition.start()
  } catch {
    return null
  }

  return {
    stop() {
      if (stopped) return
      stopped = true
      try {
        recognition.stop()
      } catch {
        // Schon beendet — nichts zu tun.
      }
      options.onStopped?.()
    },
  }
}
