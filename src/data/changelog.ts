import eintraege from './changelog.json'

/**
 * Was sich geändert hat, in einfachen Worten.
 *
 * Die Daten liegen als JSON daneben, damit sie **eine** Quelle haben: Die App
 * bindet sie ein, und `vite.config.ts` legt dieselbe Datei zusätzlich neben die
 * App, wo die laufende Fassung sie abrufen kann. So lässt sich vor dem
 * Aktualisieren zeigen, was im wartenden Update steckt.
 */

export type ChangeKind = 'fehler' | 'neu' | 'besser'

export interface ChangeEntry {
  /** Tag der Veröffentlichung, `YYYY-MM-DD`. */
  datum: string
  art: ChangeKind
  text: string
}

/** Neueste zuerst. */
export const CHANGELOG = eintraege as ChangeEntry[]

export const KIND_LABELS: Record<ChangeKind, string> = {
  fehler: 'Fehler behoben',
  neu: 'Neu',
  besser: 'Verbessert',
}

/**
 * Bringt etwas Abgerufenes auf die Form von `ChangeEntry[]`.
 *
 * Die Datei kommt über das Netz von einer **neueren** Fassung der App. Was
 * darin steht, hat diese Fassung hier nie gesehen — deshalb wird jeder Eintrag
 * einzeln geprüft und Unbrauchbares still weggelassen, statt die Anzeige daran
 * scheitern zu lassen.
 */
export function toChangelog(value: unknown): ChangeEntry[] {
  if (!Array.isArray(value)) return []
  return value.filter(isEntry)
}

function isEntry(value: unknown): value is ChangeEntry {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry.datum === 'string' &&
    typeof entry.text === 'string' &&
    entry.text.trim() !== '' &&
    (entry.art === 'fehler' || entry.art === 'neu' || entry.art === 'besser')
  )
}

/**
 * Was im wartenden Update steckt: alles, was die abgerufene Liste kennt und
 * die eingebaute nicht.
 *
 * Verglichen wird über Datum und Text, nicht über die Position — zwischen zwei
 * Fassungen kann oben etwas dazugekommen sein, und dann verschöbe sich alles.
 */
export function pendingEntries(
  live: readonly ChangeEntry[],
  bekannt: readonly ChangeEntry[] = CHANGELOG,
): ChangeEntry[] {
  const vorhanden = new Set(bekannt.map(identity))
  return live.filter((entry) => !vorhanden.has(identity(entry)))
}

function identity(entry: ChangeEntry): string {
  return `${entry.datum}|${entry.text}`
}
