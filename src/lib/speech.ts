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

  /**
   * Die Äußerung, die gerade gesprochen wird.
   *
   * **Chrome auf Android markiert Zwischenstände fälschlich als endgültig** und
   * liefert sie wachsend nach — erst „500", dann „500 g", dann „500 g Hack".
   * Wer jedes davon durchreicht, bekommt aus einer Zutat drei.
   *
   * Ob dabei die Ergebnis-Nummer hochgezählt wird oder zwischen den Teilstücken
   * die Sitzung endet, ist von Gerät zu Gerät verschieden — und ein erster
   * Anlauf, der sich auf beides verlassen hat, ging genau deshalb schief.
   * Verlässlich ist nur der Text selbst: Ist eine Fassung der Anfang der
   * anderen, ist es dieselbe Äußerung.
   */
  let buffer = ''
  let timer: number | undefined

  /** So lange muss der Text unverändert bleiben, um als fertig zu gelten. */
  const SILENCE_MS = 1200

  /**
   * Zwei Fassungen derselben Äußerung? Auch die kürzere zählt: Nach einem
   * Neustart meldet Android den Satz mitunter wieder verkürzt, und ohne diese
   * Richtung entstünde daraus ein zusätzlicher Eintrag.
   */
  function sameUtterance(a: string, b: string): boolean {
    const one = a.trim().toLocaleLowerCase('de')
    const two = b.trim().toLocaleLowerCase('de')
    return one.startsWith(two) || two.startsWith(one)
  }

  function commit() {
    if (timer !== undefined) window.clearTimeout(timer)
    timer = undefined
    const text = buffer.trim()
    buffer = ''
    if (text) options.onChunk(text)
  }

  function absorb(text: string) {
    const next = text.trim()
    if (!next) return

    // Nicht verwandt heißt: Die vorige Äußerung war fertig.
    if (buffer && !sameUtterance(buffer, next)) commit()

    // Dieselbe Äußerung, nur kürzer gemeldet — der längere Stand bleibt stehen.
    if (next.length <= buffer.trim().length) return

    buffer = next
    // Die Uhr nur bei einer echten Änderung neu stellen: Wird derselbe Text
    // wiederholt gemeldet, liefe sie sonst endlos weiter.
    if (timer !== undefined) window.clearTimeout(timer)
    timer = window.setTimeout(commit, SILENCE_MS)
  }

  function finish() {
    if (stopped) return
    stopped = true
    commit()
    options.onStopped?.()
  }

  recognition.onresult = (event) => {
    let interim = ''

    for (let index = event.resultIndex; index < event.results.length; index++) {
      const result = event.results[index]
      const text = result[0]?.transcript ?? ''
      if (result.isFinal) absorb(text)
      else interim += text
    }

    options.onInterim?.(`${buffer} ${interim}`.trim())
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

    // Hier wird bewusst **nichts** abgegeben. Auf Android endet die Sitzung
    // mitten in der Äußerung, nicht dahinter — wer hier abgibt, zerlegt genau
    // die Sätze, die er zusammenhalten soll. Der Puffer überlebt den Neustart,
    // und die Fortsetzung wird über den Text wiedererkannt.

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
      // Erst abgeben, dann beenden: Der zuletzt gesprochene Satz wartet sonst
      // noch auf seine Ruhefrist und ginge beim Stoppen verloren.
      commit()
      try {
        recognition.stop()
      } catch {
        // Schon beendet — nichts zu tun.
      }
      options.onStopped?.()
    },
  }
}
