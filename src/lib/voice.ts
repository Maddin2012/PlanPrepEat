import { useCallback, useState } from 'react'
import {
  DEFAULT_VOICE_CHOICE,
  toVoiceChoice,
  type VoiceChoice,
} from '../domain/voiceChoice.ts'

/**
 * Wo die Stimmenwahl liegt: im Browserspeicher, **je Gerät**.
 *
 * Nicht im Haushalt — und diesmal nicht aus Bequemlichkeit, sondern weil es
 * dort keinen Sinn ergäbe: Die Stimmenliste ist auf jedem Gerät eine andere,
 * ein Name von Martins Handy sagt dem anderen nichts. Und zwei Leute hören
 * ohnehin gern Verschiedenes.
 */
const KEY = 'planprepeat.stimme'

export function readVoiceChoice(): VoiceChoice {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? toVoiceChoice(JSON.parse(raw)) : DEFAULT_VOICE_CHOICE
  } catch {
    // Kein Speicher, kaputter Stand, unlesbares JSON: dann eben die Vorgabe.
    return DEFAULT_VOICE_CHOICE
  }
}

function writeVoiceChoice(choice: VoiceChoice): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(choice))
  } catch {
    // Voller oder gesperrter Speicher darf das Vorlesen nicht aufhalten.
  }
}

/**
 * Die Wahl als Zustand, der sich selbst wegschreibt.
 *
 * Wie bei der Wörterliste ohne gemeinsamen Kontext: Gelesen wird die Wahl beim
 * Vorlesen direkt aus dem Speicher (`readVoiceChoice`), verstellt wird sie nur
 * an einer Stelle — in den Einstellungen. Beides ist nie gleichzeitig offen.
 */
export function useVoiceChoice(): [VoiceChoice, (next: VoiceChoice) => void] {
  const [choice, setChoice] = useState<VoiceChoice>(readVoiceChoice)

  const save = useCallback((next: VoiceChoice) => {
    setChoice(next)
    writeVoiceChoice(next)
  }, [])

  return [choice, save]
}
