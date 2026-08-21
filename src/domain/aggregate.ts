import type {
  CategoryCode,
  Ingredient,
  PlanSlot,
  Recipe,
  ShoppingItem,
  ShoppingState,
  UnitCode,
} from './types.ts'
import { categoryRank, normalize, roundForShopping } from './units.ts'
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
  category: CategoryCode
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
          category: known?.category ?? 'other',
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
      category: bucket.category,
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
      category: entry.category,
      amount: entry.amount,
      unit: entry.unit,
      checked: state.checked[key] === true,
      edited: false,
      manual: true,
      sources: [],
    })
  }

  return items.sort(compareShoppingItems)
}

function compareShoppingItems(a: ShoppingItem, b: ShoppingItem): number {
  const byCategory = categoryRank(a.category) - categoryRank(b.category)
  if (byCategory !== 0) return byCategory
  return a.name.localeCompare(b.name, 'de', { sensitivity: 'base' })
}

export interface ShoppingGroup {
  category: CategoryCode
  items: ShoppingItem[]
}

/** Gruppiert die fertige Liste nach Supermarkt-Abteilung. */
export function groupByCategory(items: ShoppingItem[]): ShoppingGroup[] {
  const groups: ShoppingGroup[] = []
  for (const item of items) {
    const last = groups[groups.length - 1]
    if (last && last.category === item.category) last.items.push(item)
    else groups.push({ category: item.category, items: [item] })
  }
  return groups
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
