import type { ShoppingState } from './types.ts'

/**
 * Der Rückgängig-Stapel der Einkaufsliste — die rechnerische Hälfte davon.
 *
 * Im Laden wird die Liste einhändig bedient, und die Zeilen sind fingerbreit:
 * Man hakt sich leicht in der falschen Zeile ab. Gesichert wird der **ganze**
 * Zustand vor jeder Änderung, nicht eine umgekehrte Einzelaktion. Das ist nicht
 * die sparsamste Lösung, aber die ehrliche: Manche Handlung ändert zwei Felder
 * gleichzeitig — ein eigener Posten landet in `manual` *und* in der
 * Ladenreihenfolge —, und eine saubere Gegenaktion dafür gibt es nicht.
 */

export interface UndoEntry {
  /** Was zurückgenommen wird, in Worten: „Kartoffeln abgehakt". */
  label: string
  /** Der Stand **vor** dieser Handlung. */
  state: ShoppingState
}

/**
 * Wie viele Schritte zurück.
 *
 * Zwanzig ist weit mehr, als im Laden je zurückgenommen wird, und begrenzt
 * gleichzeitig, was ein langer Einkauf an Ständen mit sich herumträgt.
 */
export const UNDO_LIMIT = 20

/**
 * Einen Stand oben auflegen. Der älteste fällt unten weg.
 *
 * Gibt eine neue Liste zurück und lässt die übergebene unberührt — der Stapel
 * wird aus React gelesen, und eine von außen veränderte Liste würde dort
 * nicht als Änderung auffallen.
 */
export function pushEntry(
  list: readonly UndoEntry[],
  entry: UndoEntry,
  limit = UNDO_LIMIT,
): UndoEntry[] {
  return [entry, ...list].slice(0, limit)
}

/**
 * Eine Schreibweise des Zustands, die sich vergleichen lässt.
 *
 * Gebraucht für die Frage „hat das jemand **anderes** geändert?". Ein
 * schlichtes `JSON.stringify` taugt dafür nicht: Die Reihenfolge der Schlüssel
 * in `checked`, `checkedAmount` und `overrides` kann nach dem Weg durch Firestore
 * eine andere sein als beim Hinschreiben, und dann hielte man das eigene Echo
 * für eine fremde Änderung.
 *
 * Deshalb werden alle Schlüssel sortiert. Listen (`manual`, `storeOrder`)
 * bleiben in ihrer Reihenfolge — dort **ist** die Reihenfolge der Inhalt.
 */
export function canonical(state: ShoppingState): string {
  return JSON.stringify({
    checked: sortedEntries(state.checked),
    checkedAmount: sortedEntries(state.checkedAmount),
    overrides: sortedEntries(state.overrides),
    manual: state.manual.map((entry) => [
      entry.id,
      entry.name,
      entry.amount,
      entry.unit,
    ]),
    storeOrder: state.storeOrder,
  })
}

function sortedEntries<T>(record: Record<string, T>): [string, T][] {
  return Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
}
