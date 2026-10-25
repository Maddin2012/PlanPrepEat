import type { ISODate } from './types.ts'
import { addDays } from './planWindow.ts'

/**
 * Häkchen auf der Einkaufsliste — und wann sie verfallen.
 *
 * **Ein Haken ist eine Notiz für einen Einkauf, keine Eigenschaft der Zutat.**
 * Früher war er unbefristet und galt, solange die Zutat überhaupt noch
 * irgendwo eingeplant war. Bei Kartoffeln und Zwiebeln heißt das praktisch für
 * immer.
 *
 * Deshalb trägt jede Marke den Tag, an dem sie gesetzt wurde, und gilt eine
 * Woche. Das ist der Rhythmus, in dem eingekauft wird: Was letzte Woche schon
 * im Haus war, ist diese Woche eine offene Frage. Seit das Streichen weg ist,
 * ist der Haken der einzige Weg, einen Posten von der Liste zu bekommen — und
 * diese Frist damit das Einzige, was ihn wieder aufmacht.
 */

/** Schlüssel der Einkaufsliste → der Tag, an dem die Marke gesetzt wurde. */
export type MarkMap = Record<string, ISODate>

/**
 * Wie lange eine Marke gilt.
 *
 * Eine Woche, nicht ein Tag: Man schreibt die Liste nicht am Einkaufstag,
 * sondern über die Woche verteilt. Und nicht einen Monat: Dann wäre man wieder
 * bei „gilt praktisch immer".
 */
export const MARK_DAYS = 7

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Gilt die Marke heute noch?
 *
 * Ein Datum in der **Zukunft** gilt. Das ist kein Schönheitsfehler, sondern
 * nötig: Im Haushalt hängen zwei Geräte an derselben Liste, und geht die Uhr
 * des anderen vor, dürfte eine gerade gesetzte Marke nicht sofort verfallen.
 *
 * ISO-Daten werden als Text verglichen — `'2026-10-20' < '2026-10-21'` stimmt,
 * weil Jahr, Monat und Tag in dieser Reihenfolge und mit führenden Nullen
 * dastehen. Deshalb braucht es hier keine Datumsrechnung.
 */
export function isMarkActive(
  set: ISODate | undefined,
  today: ISODate,
): boolean {
  if (!set || !ISO_DATE.test(set)) return false
  return addDays(set, MARK_DAYS) > today
}

/** Eine Marke setzen. Die übergebene Sammlung bleibt unberührt. */
export function setMark(marks: MarkMap, key: string, today: ISODate): MarkMap {
  return { ...marks, [key]: today }
}

/** Eine Marke wieder loswerden. */
export function clearMark(marks: MarkMap, key: string): MarkMap {
  const { [key]: _weg, ...rest } = marks
  return rest
}

/**
 * Verfallene Marken wegräumen.
 *
 * Fürs Rechnen nicht nötig — `isMarkActive` übergeht sie ohnehin. Es hält nur
 * das gespeicherte Dokument klein, das sonst über Jahre mit jeder je
 * abgehakten Zutat wächst.
 */
export function dropExpired(marks: MarkMap, today: ISODate): MarkMap {
  const result: MarkMap = {}
  for (const [key, set] of Object.entries(marks)) {
    if (isMarkActive(set, today)) result[key] = set
  }
  return result
}

/**
 * Einen gelesenen Stand auf die Form der Marken bringen.
 *
 * Nimmt nur `{ schlüssel: 'JJJJ-MM-TT' }` an. Die **alte** Form — `checked`
 * als Zuordnung auf `true` — ergibt nichts, und das ist so gewollt: Ein Haken
 * ohne Datum stammt aus der Zeit vor dieser Regel, ist also mit Sicherheit
 * älter als eine Woche. Beim ersten Start nach dem Update steht die Liste
 * deshalb einmal wieder vollständig offen da — und genau dadurch kommen die
 * Zutaten zurück, die unterwegs verschwunden waren.
 */
export function toMarkMap(value: unknown): MarkMap {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {}
  }
  const result: MarkMap = {}
  for (const [key, set] of Object.entries(value as Record<string, unknown>)) {
    if (typeof set === 'string' && ISO_DATE.test(set)) result[key] = set
  }
  return result
}

/**
 * Die Menge, die beim Abhaken nötig war — neben dem Häkchen.
 *
 * Zwei Felder statt eines, weil eine `MarkMap` ein Datum trägt und sonst
 * nichts. Zusammengehalten werden sie an den drei Stellen, an denen ein
 * Häkchen entsteht, verschwindet oder verfällt; `pruneShoppingState` wirft
 * zusätzlich jede Menge weg, deren Häkchen nicht mehr da ist.
 */
export type AmountMap = Record<string, number>

/**
 * Die Menge zum Häkchen merken.
 *
 * **Ein Posten ohne Mengenangabe bekommt keinen Eintrag.** Salz hat keine Zahl,
 * die wachsen könnte, und `undefined` nähme Firestore ohnehin nicht an.
 */
export function rememberAmount(
  amounts: AmountMap,
  key: string,
  amount: number | null,
): AmountMap {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return amounts
  return { ...amounts, [key]: amount }
}

/** Die gemerkte Menge loswerden — das Häkchen geht gerade mit weg. */
export function dropAmount(amounts: AmountMap, key: string): AmountMap {
  if (!(key in amounts)) return amounts
  const { [key]: _weg, ...rest } = amounts
  return rest
}
