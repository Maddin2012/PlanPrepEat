import { useEffect, useState } from 'react'

/**
 * Vorlesen über die Sprachausgabe des Browsers.
 *
 * Das Gegenstück zu `speech.ts`: dort zuhören, hier sprechen. Auch das ist
 * eingebaut — kein Schlüssel, kein Server, und im Gegensatz zur Erkennung
 * braucht es nicht einmal Internet, sobald eine Stimme auf dem Gerät liegt.
 *
 * **Ohne deutsche Stimme wird nicht vorgelesen.** Eine englische Stimme, die
 * „Zwiebeln würfeln" vorträgt, ist kein halber Nutzen, sondern gar keiner.
 * Deshalb fragt jede Stelle vorher `useGermanVoice()` und lässt den Knopf sonst
 * weg — wie beim Mikrofon auch.
 */

function synthesis(): SpeechSynthesis | null {
  // Erst beim Aufruf nachsehen, nicht beim Laden der Datei: Tests und der
  // Produktionsbau laufen sonst gegen ein `window`, das es noch nicht gibt.
  if (typeof window === 'undefined') return null
  return window.speechSynthesis ?? null
}

/** Kann dieses Gerät überhaupt sprechen? */
export function isReadingAvailable(): boolean {
  return synthesis() !== null && typeof window.SpeechSynthesisUtterance === 'function'
}

/** Die erste deutsche Stimme, die das Gerät anbietet — oder `null`. */
export function germanVoice(): SpeechSynthesisVoice | null {
  const stimmen = synthesis()?.getVoices() ?? []
  return stimmen.find((stimme) => /^de/i.test(stimme.lang ?? '')) ?? null
}

/**
 * Ob eine deutsche Stimme bereitsteht.
 *
 * **Die Liste der Stimmen ist beim ersten Rendern regelmäßig noch leer** und
 * wird nachgereicht. Deshalb wird auf `voiceschanged` gehört — und zusätzlich
 * ein paarmal nachgesehen: Manche Browser melden das Ereignis nie, obwohl die
 * Stimmen längst da sind. Wer sich nur auf das Ereignis verlässt, bekommt auf
 * genau diesen Geräten nie einen Vorlese-Knopf.
 */
export function useGermanVoice(): boolean {
  const [vorhanden, setVorhanden] = useState(() => germanVoice() !== null)

  useEffect(() => {
    if (vorhanden) return
    const stimme = synthesis()
    if (!stimme) return

    let versuche = 0
    const nachsehen = () => {
      if (germanVoice()) {
        setVorhanden(true)
        return true
      }
      return false
    }

    stimme.addEventListener?.('voiceschanged', nachsehen)
    const uhr = window.setInterval(() => {
      versuche += 1
      if (nachsehen() || versuche >= 10) window.clearInterval(uhr)
    }, 250)

    return () => {
      stimme.removeEventListener?.('voiceschanged', nachsehen)
      window.clearInterval(uhr)
    }
  }, [vorhanden])

  return vorhanden
}

export interface ReadingHandle {
  /** Bricht ab. Mehrfach aufzurufen ist harmlos. */
  cancel(): void
}

/**
 * Liest einen Text vor. Gibt `null` zurück, wenn das Gerät nicht mitspielt.
 *
 * `onEnd` kommt genau einmal und **nur**, wenn der Text wirklich zu Ende
 * gelesen wurde. Das ist der Grund für das `abgebrochen` weiter unten:
 * `cancel()` löst in den meisten Browsern dasselbe Ereignis aus wie das
 * ordentliche Ende. Ohne die Unterscheidung würde das Abbrechen als „fertig"
 * durchgehen — und die Vorleserei spränge beim Anhalten fröhlich zum nächsten
 * Schritt.
 */
export function startReading(
  text: string,
  options: { onEnd?: () => void; onError?: () => void } = {},
): ReadingHandle | null {
  const stimme = synthesis()
  if (!stimme || typeof window.SpeechSynthesisUtterance !== 'function') return null

  let abgebrochen = false

  const utterance = new window.SpeechSynthesisUtterance(text)
  utterance.lang = 'de-DE'
  const deutsch = germanVoice()
  if (deutsch) utterance.voice = deutsch
  // Etwas langsamer als der Vorgabewert: Vorgelesen wird beim Kochen, mit den
  // Händen im Teig und dem Gerät zwei Schritte weiter.
  utterance.rate = 0.95

  utterance.onend = () => {
    if (abgebrochen) return
    options.onEnd?.()
  }
  utterance.onerror = () => {
    if (abgebrochen) return
    abgebrochen = true
    options.onError?.()
  }

  // Was noch in der Warteschlange steht, muss weg — sonst redet der vorige
  // Schritt weiter, während der nächste schon angefangen hat.
  stimme.cancel()
  stimme.speak(utterance)

  return {
    cancel() {
      if (abgebrochen) return
      abgebrochen = true
      stimme.cancel()
    },
  }
}
