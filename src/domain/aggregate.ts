import type {
  Ingredient,
  PlanSlot,
  Recipe,
  ShoppingItem,
  ShoppingState,
  UnitCode,
} from './types.ts'
import { isRecipeEntry } from './types.ts'
import { normalize, roundForShopping } from './units.ts'
import { scaleAmount } from './scaling.ts'

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
  return `manual|${id}`
}

/**
 * Der Rückweg: die Kennung aus einem Schlüssel wie `manual|abc123`.
 *
 * Ein Posten in der Liste kennt nur seinen Schlüssel; zum Zurückschreiben in
 * `state.manual` wird die Kennung wieder gebraucht. Für alles andere — etwa den
 * Schlüssel eines abgeleiteten Postens — kommt `null` heraus.
 */
export function parseManualKey(key: string): string | null {
  const id = key.startsWith('manual|') ? key.slice('manual|'.length) : ''
  return id === '' ? null : id
}

export interface PlannedRecipe {
  recipe: Recipe
  servings: number
}

/**
 * Sammelt alle im Zeitraum eingeplanten Rezepte ein. Ein Rezept, das an mehreren
 * Tagen vorkommt, erscheint mehrfach — genau das soll sich in der Einkaufsliste
 * ja auch summieren.
 */
export function collectPlanned(
  slots: PlanSlot[],
  recipesById: Map<string, Recipe>,
): PlannedRecipe[] {
  const planned: PlannedRecipe[] = []
  for (const slot of slots) {
    for (const entry of slot.entries) {
      // Freie Einträge („Pizza bestellen") haben keine Zutaten. Ausgesiebt
      // würden sie auch von der Prüfung darunter — ohne `recipeId` findet die
      // Suche ohnehin nichts. Diese Zeile ist trotzdem nötig, damit der
      // Übersetzer die beiden Eintragsformen auseinanderhalten kann.
      if (!isRecipeEntry(entry)) continue
      const recipe = recipesById.get(entry.recipeId)
      // Ein zwischenzeitlich gelöschtes Rezept wird stillschweigend übersprungen.
      if (!recipe) continue
      planned.push({ recipe, servings: entry.servings })
    }
  }
  return planned
}

interface Bucket {
  key: string
  name: string
  amount: number
  unit: UnitCode
  sources: Set<string>
}

/**
 * Baut die Einkaufsliste aus den eingeplanten Rezepten und legt den
 * Nutzer-Zustand darüber: Häkchen, korrigierte Mengen, gestrichene Posten und
 * eigene Einträge. Die berechneten Posten selbst werden nirgends gespeichert,
 * deshalb übersteht der Zustand jede Änderung am Essensplan.
 */
export function buildShoppingList(
  planned: PlannedRecipe[],
  ingredients: Map<string, Ingredient>,
  state: ShoppingState,
): ShoppingItem[] {
  const buckets = new Map<string, Bucket>()

  for (const { recipe, servings } of planned) {
    for (const item of recipe.items) {
      const scaled = scaleAmount(item.amount, recipe.servings, servings)
      const { amount, unit } = normalize(scaled, item.unit)
      const key = shoppingKey(item.ingredientId, unit)
      const known = ingredients.get(item.ingredientId)

      const bucket = buckets.get(key)
      if (bucket) {
        bucket.amount += amount
        bucket.sources.add(recipe.name)
      } else {
        buckets.set(key, {
          key,
          name: known?.name ?? item.name,
          amount,
          unit,
          sources: new Set([recipe.name]),
        })
      }
    }
  }

  const removed = new Set(state.removed)
  const items: ShoppingItem[] = []

  for (const bucket of buckets.values()) {
    if (removed.has(bucket.key)) continue
    const override = state.overrides[bucket.key]
    const hasOverride = typeof override === 'number' && Number.isFinite(override)
    const amount = hasOverride
      ? override
      : roundForShopping(bucket.amount, bucket.unit)

    items.push({
      key: bucket.key,
      name: bucket.name,
      // Menge 0 heißt „ohne Mengenangabe" (z.B. Salz nach Geschmack) und wird
      // in der Liste nur mit dem Namen dargestellt.
      amount: amount === 0 ? null : amount,
      unit: amount === 0 ? null : bucket.unit,
      checked: state.checked[bucket.key] === true,
      edited: hasOverride,
      manual: false,
      sources: [...bucket.sources].sort((a, b) => a.localeCompare(b, 'de')),
    })
  }

  for (const entry of state.manual) {
    const key = manualKey(entry.id)
    items.push({
      key,
      name: entry.name,
      amount: entry.amount,
      unit: entry.unit,
      checked: state.checked[key] === true,
      edited: false,
      manual: true,
      sources: [],
    })
  }

  return items.sort(shoppingComparator(state.order))
}

/**
 * Die Reihenfolge der Einkaufsliste, in drei Stufen:
 *
 * 1. Offene Posten vor abgehakten — Erledigtes rutscht nach unten und bleibt
 *    dort durchgestrichen stehen, statt zwischen dem zu stören, was noch fehlt.
 * 2. Innerhalb dessen die von Hand gewählte Reihenfolge aus `order`.
 * 3. Was in `order` nicht vorkommt, alphabetisch und hinten dran. Das betrifft
 *    alles, was später über ein neu eingeplantes Rezept dazugekommen ist.
 *
 * Der Index wird einmal als Map vorgebaut, statt bei jedem Vergleich durch das
 * Array zu suchen.
 */
export function shoppingComparator(
  order: readonly string[] = [],
): (a: ShoppingItem, b: ShoppingItem) => number {
  const position = new Map(order.map((key, index) => [key, index]))
  const rank = (item: ShoppingItem) => position.get(item.key) ?? Infinity

  return (a, b) => {
    if (a.checked !== b.checked) return a.checked ? 1 : -1

    // Ränge direkt vergleichen statt zu subtrahieren: Bei zwei unbekannten
    // Posten wäre die Differenz NaN, bei bekannt gegen unbekannt unendlich.
    const rankA = rank(a)
    const rankB = rank(b)
    if (rankA !== rankB) return rankA < rankB ? -1 : 1

    return a.name.localeCompare(b.name, 'de', { sensitivity: 'base' })
  }
}

/**
 * Entfernt Zustand, der zu keinem Posten mehr gehört — etwa das Häkchen einer
 * Zutat, deren Rezept inzwischen aus dem Plan geflogen ist. Ohne das würde ein
 * später wieder eingeplantes Rezept mit bereits gesetzten Häkchen auftauchen.
 */
export function pruneShoppingState(
  state: ShoppingState,
  liveKeys: Set<string>,
): ShoppingState {
  const manualKeys = new Set(state.manual.map((entry) => manualKey(entry.id)))
  const isLive = (key: string) => liveKeys.has(key) || manualKeys.has(key)

  return {
    checked: pickKeys(state.checked, isLive),
    overrides: pickKeys(state.overrides, isLive),
    removed: state.removed.filter(isLive),
    manual: state.manual,
    order: state.order.filter(isLive),
  }
}

function pickKeys<T>(
  source: Record<string, T>,
  keep: (key: string) => boolean,
): Record<string, T> {
  const result: Record<string, T> = {}
  for (const [key, value] of Object.entries(source)) {
    if (keep(key)) result[key] = value
  }
  return result
}

/**
 * Alle Schlüssel, die der aktuelle Plan erzeugt — inklusive der gestrichenen,
 * denn „hab ich noch da" muss ja erhalten bleiben, solange das Rezept im Plan ist.
 */
export function liveShoppingKeys(planned: PlannedRecipe[]): Set<string> {
  const keys = new Set<string>()
  for (const { recipe } of planned) {
    for (const item of recipe.items) {
      keys.add(shoppingKey(item.ingredientId, normalize(0, item.unit).unit))
    }
  }
  return keys
}
