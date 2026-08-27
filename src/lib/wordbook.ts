import { useCallback, useState } from 'react'
import { toCorrections, type Correction } from '../domain/corrections.ts'

/**
 * Wo die eigene Wörterliste liegt: im Browserspeicher, **je Gerät**.
 *
 * Nicht im Haushalt, obwohl das schöner wäre — beide Geräte lernten dann
 * voneinander. Es kostete aber eine Erweiterung der Ablage-Schnittstelle samt
 * beider Adapter, und ob sich die Liste überhaupt bewährt, weiß noch niemand.
 * Der Umzug bleibt möglich: Die Logik in `domain/corrections.ts` weiß nichts
 * davon, wo sie steht.
 */
const KEY = 'planprepeat.wordbook'

export function readWordbook(): Correction[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? toCorrections(JSON.parse(raw)) : []
  } catch {
    // Kein Speicher, kaputter Stand, unlesbares JSON: dann eben ohne Liste.
    return []
  }
}

function writeWordbook(list: readonly Correction[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // Voller oder gesperrter Speicher darf das Diktat nicht aufhalten.
  }
}

/**
 * Die Liste als Zustand, der sich selbst wegschreibt.
 *
 * Absichtlich ohne gemeinsamen Kontext: Die beiden Stellen, die sie brauchen —
 * das Rezeptformular und die Einstellungen — sind nie gleichzeitig offen.
 */
export function useWordbook(): [
  Correction[],
  (next: readonly Correction[]) => void,
] {
  const [list, setList] = useState<Correction[]>(readWordbook)

  const save = useCallback((next: readonly Correction[]) => {
    const kopie = [...next]
    setList(kopie)
    writeWordbook(kopie)
  }, [])

  return [list, save]
}
