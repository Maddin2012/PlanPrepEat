import type { Recipe, RecipeItem } from './types.ts'

/**
 * Rechnet eine Menge von der Portionszahl des Rezepts auf die tatsächlich
 * gekochte Portionszahl hoch. Eine Portionsangabe von 0 (oder etwas
 * Kaputtem aus alten Daten) wird als 1 gelesen, damit nie durch null geteilt
 * wird und die Mengen im Zweifel unverändert bleiben.
 */
export function scaleAmount(
  amount: number,
  fromServings: number,
  toServings: number,
): number {
  const from = safeServings(fromServings)
  const to = safeServings(toServings)
  return (amount * to) / from
}

/** Alle Zutaten eines Rezepts auf eine Ziel-Portionszahl umgerechnet. */
export function scaleItems(recipe: Recipe, toServings: number): RecipeItem[] {
  return recipe.items.map((item) => ({
    ...item,
    amount: scaleAmount(item.amount, recipe.servings, toServings),
  }))
}

export function safeServings(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1
}
