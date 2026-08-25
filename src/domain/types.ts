import { orderKey } from './shoppingKeys.ts'

/** Datum im Format YYYY-MM-DD, immer als lokales Kalenderdatum gemeint. */
export type ISODate = string

/**
 * Einheiten-Codes. Bewusst ASCII, damit sie gefahrlos als Bestandteil von
 * Firestore-Map-Schlüsseln benutzt werden können. Die deutsche Beschriftung
 * liegt in `UNIT_LABELS` (units.ts).
 */
export type UnitCode =
  | 'g'
  | 'kg'
  | 'ml'
  | 'l'
  | 'stk'
  | 'el'
  | 'tl'
  | 'prise'
  | 'bund'
  | 'pkg'

/**
 * Ein Eintrag aus dem Zutaten-Katalog. Der Katalog liefert die Vorschläge beim
 * Tippen und verhindert, dass „Zwiebel" und „Zwiebeln" in der Einkaufsliste als
 * zwei getrennte Posten landen.
 */
export interface Ingredient {
  id: string
  name: string
  /** Einheit, die beim Anlegen einer neuen Rezeptzeile vorgeschlagen wird. */
  defaultUnit: UnitCode
}

/** Eine Zutatenzeile innerhalb eines Rezepts. */
export interface RecipeItem {
  ingredientId: string
  /** Name zum Zeitpunkt der Erfassung — überlebt ein gelöschtes Katalog-Item. */
  name: string
  amount: number
  unit: UnitCode
  /** Freitext wie „fein gewürfelt". Landet nicht auf der Einkaufsliste. */
  note?: string
}

export interface Recipe {
  id: string
  name: string
  /** Für wie viele Portionen die Mengen in `items` gelten. Immer >= 1. */
  servings: number
  /** Zubereitungszeit in Minuten, 0 = keine Angabe. */
  minutes: number
  /** Zubereitungsschritte als Fließtext, eine Zeile pro Schritt. */
  steps: string
  items: RecipeItem[]
  /** Stark verkleinertes Vorschaubild als Data-URL, für die Listenansicht. */
  thumb?: string
  /** Ob zu diesem Rezept ein Vollbild existiert (liegt in einem Subdokument). */
  hasPhoto?: boolean
  createdAt: number
  updatedAt: number
}

export type Meal = 'lunch' | 'dinner'

/** Ein auf einen Mahlzeiten-Platz gelegtes Rezept. */
export interface RecipePlanEntry {
  recipeId: string
  /** Für wie viele Portionen an diesem Tag gekocht wird. */
  servings: number
}

/**
 * Ein frei eingetippter Eintrag — „Pizza bestellen", „Reste", „bei Oma".
 *
 * Er hat kein Rezept und damit keine Zutaten. Auf der Einkaufsliste taucht er
 * deshalb nicht auf: „Grillen" sagt nicht, was gekauft werden muss. Wer dafür
 * etwas braucht, trägt es dort als eigenen Posten ein.
 */
export interface TextPlanEntry {
  text: string
}

export type PlanEntry = RecipePlanEntry | TextPlanEntry

export function isRecipeEntry(entry: PlanEntry): entry is RecipePlanEntry {
  return typeof (entry as RecipePlanEntry).recipeId === 'string'
}

/**
 * Bringt einen gelesenen Eintrag auf eine der beiden Formen, oder `null`.
 *
 * Steht an genau einer Stelle, weil beide Ablagen dieselbe Frage haben: Was
 * aus Firestore oder aus dem Browserspeicher kommt, ist erst einmal nur
 * „irgendetwas" — ein Stand aus einer älteren Fassung der App, ein halb
 * geschriebenes Dokument. Ein Eintrag der alten Form (nur `recipeId` und
 * `servings`) kommt hier unverändert wieder heraus; deshalb braucht es für die
 * vorhandenen Pläne keinen Umbau.
 */
export function toPlanEntry(value: unknown): PlanEntry | null {
  if (typeof value !== 'object' || value === null) return null
  const entry = value as Record<string, unknown>

  // Das Rezept hat Vorrang: Ein alter Eintrag soll unter keinen Umständen
  // versehentlich als freier Text durchgehen.
  if (typeof entry.recipeId === 'string' && entry.recipeId !== '') {
    const servings = entry.servings
    return {
      recipeId: entry.recipeId,
      servings: typeof servings === 'number' && servings > 0 ? servings : 1,
    }
  }

  if (typeof entry.text === 'string' && entry.text.trim() !== '') {
    return { text: entry.text.trim() }
  }

  return null
}

/** Der Inhalt eines Mahlzeiten-Platzes, z.B. Hauptgericht plus Beilage. */
export interface PlanSlot {
  key: string
  entries: PlanEntry[]
}

/** Ein selbst hinzugefügter Posten auf der Einkaufsliste, z.B. „Klopapier". */
export interface ManualItem {
  id: string
  name: string
  amount: number | null
  unit: UnitCode | null
}

/**
 * Der *Nutzer-Zustand* über der Einkaufsliste. Die Posten selbst werden aus dem
 * Plan berechnet und nie gespeichert — gespeichert wird nur, was der Mensch
 * daran verändert hat. Dadurch darf sich der Plan beliebig ändern, ohne dass
 * gesetzte Häkchen oder eigene Einträge verloren gehen.
 */
export interface ShoppingState {
  /** Abgehakte Posten, Schlüssel siehe `shoppingKey()`. */
  checked: Record<string, boolean>
  /** Von Hand korrigierte Mengen, überschreiben den berechneten Wert. */
  overrides: Record<string, number>
  /** Weggestrichene abgeleitete Posten („hab ich noch da"). */
  removed: string[]
  manual: ManualItem[]
  /**
   * Die **Ladenreihenfolge**: die Runde durch den Laden, so wie man sie geht.
   *
   * Eine Liste von Zutat-Kennungen (bei eigenen Posten deren Schlüssel), nicht
   * von Listenschlüsseln — siehe `orderKey`. Sonst bekäme dieselbe Zutat je
   * Einheit einen eigenen Platz.
   *
   * Leer heißt „noch nie etwas verschoben"; dann bleibt die Liste alphabetisch.
   * Das erste Verschieben schreibt die Runde fest, und sie **bleibt stehen** —
   * auch für Zutaten, die gerade gar nicht auf der Liste sind. Was hier fehlt,
   * hängt sich alphabetisch hinten an, statt sich in die Runde zu mogeln.
   */
  storeOrder: string[]
}

/** Ein fertig berechneter Posten der Einkaufsliste. */
export interface ShoppingItem {
  key: string
  name: string
  /** null nur bei manuellen Posten ohne Mengenangabe. */
  amount: number | null
  unit: UnitCode | null
  checked: boolean
  /** true, wenn die Menge von Hand überschrieben wurde. */
  edited: boolean
  /** true bei selbst hinzugefügten Posten. */
  manual: boolean
  /** Aus welchen Rezepten sich der Posten zusammensetzt (für die Anzeige). */
  sources: string[]
}

export const emptyShoppingState = (): ShoppingState => ({
  checked: {},
  overrides: {},
  removed: [],
  manual: [],
  storeOrder: [],
})

/**
 * Bringt einen gelesenen Wert auf die Form von `ShoppingState`.
 *
 * Alles, was aus einer Ablage kommt, ist erst einmal nur „irgendetwas": ein
 * Stand aus einer älteren Fassung der App, ein halb geschriebenes Dokument,
 * beschädigtes localStorage. Fehlt darin nur ein Feld, läuft die Berechnung der
 * Einkaufsliste in einen Fehler und der Reiter bleibt weiß — deshalb wird hier
 * jedes Feld einzeln geprüft und im Zweifel auf den leeren Wert gesetzt.
 */
export function normalizeShoppingState(value: unknown): ShoppingState {
  const empty = emptyShoppingState()
  // Ein Array ist die alte Form „Liste von [Zeitraum, Zustand]-Paaren".
  if (!isRecord(value)) return empty

  return {
    checked: isRecord(value.checked)
      ? pickBy(value.checked, (entry) => entry === true)
      : empty.checked,
    overrides: isRecord(value.overrides)
      ? pickBy(value.overrides, (entry) => typeof entry === 'number')
      : empty.overrides,
    removed: onlyStrings(value.removed),
    manual: Array.isArray(value.manual)
      ? value.manual.filter(isManualItem)
      : empty.manual,
    storeOrder: readStoreOrder(value),
  }
}

/**
 * Die Ladenreihenfolge lesen — und einen Stand aus der Zeit davor übernehmen.
 *
 * Vorher hieß das Feld `order` und enthielt volle Listenschlüssel
 * („zutat|g"). Wer schon einmal sortiert hat, soll das nicht noch einmal tun
 * müssen, also werden die alten Schlüssel auf ihre Zutat zurückgeführt.
 * Doppelte fallen dabei weg: Dieselbe Zutat in zwei Einheiten hatte zwei
 * Einträge und hat jetzt einen.
 */
function readStoreOrder(value: Record<string, unknown>): string[] {
  if (Array.isArray(value.storeOrder)) return onlyStrings(value.storeOrder)
  return [...new Set(onlyStrings(value.order).map(orderKey))]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function onlyStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((e) => typeof e === 'string') : []
}

function pickBy<T>(
  source: Record<string, unknown>,
  keep: (value: unknown) => boolean,
): Record<string, T> {
  const result: Record<string, T> = {}
  for (const [key, entry] of Object.entries(source)) {
    if (keep(entry)) result[key] = entry as T
  }
  return result
}

function isManualItem(value: unknown): value is ManualItem {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string'
  )
}
