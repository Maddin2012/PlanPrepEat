import { useEffect, useState } from 'react'
import { TEMPO, pickVoiceName, type Tempo } from '../domain/voiceChoice.ts'
import { readVoiceChoice } from './voice.ts'

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

/** Alle deutschen Stimmen, die das Gerät anbietet — in seiner Reihenfolge. */
export function germanVoices(): SpeechSynthesisVoice[] {
  const stimmen = synthesis()?.getVoices() ?? []
  return stimmen.filter((stimme) => /^de/i.test(stimme.lang ?? ''))
}

/** Die erste deutsche Stimme, die das Gerät anbietet — oder `null`. */
export function germanVoice(): SpeechSynthesisVoice | null {
  return germanVoices()[0] ?? null
}

/**
 * Die deutschen Stimmen des Geräts, sobald sie da sind.
 *
 * **Die Liste der Stimmen ist beim ersten Rendern regelmäßig noch leer** und
 * wird nachgereicht. Deshalb wird auf `voiceschanged` gehört — und zusätzlich
 * ein paarmal nachgesehen: Manche Browser melden das Ereignis nie, obwohl die
 * Stimmen längst da sind. Wer sich nur auf das Ereignis verlässt, bekommt auf
 * genau diesen Geräten nie einen Vorlese-Knopf.
 *
 * Gewartet wird nur, **bis die erste** da ist. Ob der Browser danach noch
 * weitere nachreicht, lässt sich nicht wissen — und ein Warten „auf alle" hätte
 * kein Ende.
 */
export function useGermanVoices(): SpeechSynthesisVoice[] {
  const [stimmen, setStimmen] = useState<SpeechSynthesisVoice[]>(germanVoices)

  useEffect(() => {
    if (stimmen.length > 0) return
    const sprache = synthesis()
    if (!sprache) return

    let versuche = 0
    const nachsehen = () => {
      const gefunden = germanVoices()
      if (gefunden.length > 0) {
        setStimmen(gefunden)
        return true
      }
      return false
    }

    sprache.addEventListener?.('voiceschanged', nachsehen)
    const uhr = window.setInterval(() => {
      versuche += 1
      if (nachsehen() || versuche >= 10) window.clearInterval(uhr)
    }, 250)

    return () => {
      sprache.removeEventListener?.('voiceschanged', nachsehen)
      window.clearInterval(uhr)
    }
  }, [stimmen.length])

  return stimmen
}

/** Ob überhaupt eine deutsche Stimme bereitsteht. */
export function useGermanVoice(): boolean {
  return useGermanVoices().length > 0
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
  options: {
    onEnd?: () => void
    onError?: () => void
    /**
     * Eine bestimmte Stimme statt der gespeicherten Wahl — für „Probe hören"
     * in den Einstellungen, wo man ja gerade eine andere antippt.
     */
    voiceName?: string
    /** Ein bestimmtes Tempo statt des gespeicherten. */
    tempo?: Tempo
  } = {},
): ReadingHandle | null {
  const sprache = synthesis()
  if (!sprache || typeof window.SpeechSynthesisUtterance !== 'function') return null

  let abgebrochen = false

  const utterance = new window.SpeechSynthesisUtterance(text)
  utterance.lang = 'de-DE'

  // Ohne Angabe gilt, was in den Einstellungen gewählt wurde. Der Umweg über
  // `pickVoiceName` ist wichtig: Er fängt den Fall ab, dass die gewählte Stimme
  // auf diesem Gerät gar nicht (mehr) existiert.
  const gespeichert = readVoiceChoice()
  const stimmen = germanVoices()
  const gesucht = options.voiceName ?? gespeichert.name
  const name = pickVoiceName(
    stimmen.map((stimme) => stimme.name),
    gesucht,
  )
  const deutsch = stimmen.find((stimme) => stimme.name === name)
  if (deutsch) utterance.voice = deutsch

  // Vorgelesen wird beim Kochen, mit den Händen im Teig und dem Gerät zwei
  // Schritte weiter — deshalb ist selbst „normal" etwas langsamer als der
  // Vorgabewert des Browsers.
  utterance.rate = TEMPO[options.tempo ?? gespeichert.tempo]

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
  sprache.cancel()
  sprache.speak(utterance)

  return {
    cancel() {
      if (abgebrochen) return
      abgebrochen = true
      sprache.cancel()
    },
  }
}
