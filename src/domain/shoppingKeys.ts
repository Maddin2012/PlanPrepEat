import type { UnitCode } from './types.ts'

/**
 * Die Schlüssel der Einkaufsliste.
 *
 * Eigener Baustein, weil zwei Module sie brauchen: `aggregate.ts` baut die
 * Liste damit auf, und `types.ts` muss beim Lesen eines gespeicherten Standes
 * die Ladenreihenfolge übersetzen. Stünde das Format an beiden Stellen, liefen
 * sie irgendwann auseinander.
 */

const MANUAL_PREFIX = 'manual|'

/**
 * Schlüssel eines abgeleiteten Postens. Zutat *und* Basiseinheit gehen ein:
 * „Milch, 500 ml" und „Milch, 2 EL" bleiben dadurch getrennte Zeilen, statt zu
 * einer falschen Summe verschmolzen zu werden.
 */
export function shoppingKey(ingredientId: string, unit: UnitCode): string {
  return `${ingredientId}|${unit}`
}

/** Schlüssel eines selbst hinzugefügten Postens. */
export function manualKey(id: string): string {
  return `${MANUAL_PREFIX}${id}`
}

/**
 * Der Rückweg: die Kennung aus einem Schlüssel wie `manual|abc123`.
 *
 * Ein Posten in der Liste kennt nur seinen Schlüssel; zum Zurückschreiben in
 * `state.manual` wird die Kennung wieder gebraucht. Für alles andere — etwa den
 * Schlüssel eines abgeleiteten Postens — kommt `null` heraus.
 */
export function parseManualKey(key: string): string | null {
  const id = key.startsWith(MANUAL_PREFIX) ? key.slice(MANUAL_PREFIX.length) : ''
  return id === '' ? null : id
}

/**
 * Woran die Ladenreihenfolge einen Posten festmacht.
 *
 * Bei einem abgeleiteten Posten ist das die **Zutat**, nicht der volle
 * Schlüssel: In dem steckt auch die Einheit, und „Tomaten in Gramm" und
 * „Tomaten in Stück" bekämen sonst zwei verschiedene Plätze im Laden. Wer die
 * Tomaten einmal nach vorn geschoben hat, will sie dort haben — unabhängig
 * davon, wie das Rezept sie gerade angibt.
 *
 * Eigene Posten haben keine Zutat und behalten deshalb ihren eigenen Schlüssel.
 */
export function orderKey(key: string): string {
  if (key.startsWith(MANUAL_PREFIX)) return key
  const separator = key.indexOf('|')
  return separator === -1 ? key : key.slice(0, separator)
}
