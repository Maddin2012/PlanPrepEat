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
export interface PlanEntry {
  recipeId: string
  /** Für wie viele Portionen an diesem Tag gekocht wird. */
  servings: number
}

/** Der Inhalt eines Mahlzeiten-Platzes, z.B. Hauptgericht plus Beilage. */
export interface PlanSlot {
  key: string
  entries: PlanEntry[]
}

/** Ein Planungszeitraum von 12 Tagen, beginnend an einem Mittwoch. */
export interface Plan {
  id: string
  startDate: ISODate
  createdAt: number
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
   * Die von Hand gewählte Reihenfolge, als Liste von Schlüsseln.
   *
   * Leer heißt „noch nie etwas verschoben" — dann bleibt die Liste
   * alphabetisch. Erst das erste Verschieben schreibt die Reihenfolge fest.
   * Posten, die hier fehlen (weil sie später über ein neues Rezept dazukamen),
   * hängen sich alphabetisch hinten an, statt sich in die sortierte
   * Ladenrunde zu mogeln.
   */
  order: string[]
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
  order: [],
})
