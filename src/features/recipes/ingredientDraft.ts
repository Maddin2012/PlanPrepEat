import type { Ingredient, RecipeItem, UnitCode } from '../../domain/types.ts'
import { newId } from '../../data/ids.ts'
import type { Repository } from '../../data/repository.ts'

/** Eine Zutatenzeile im Formular. Die Menge bleibt Text, damit man „1,5"
 *  tippen kann, ohne dass die Eingabe unter den Fingern springt. */
export interface ItemDraft {
  /** Nur für React — die Zeile hat noch keine Kennung. */
  key: string
  name: string
  amount: string
  unit: UnitCode
  note: string
}

export function emptyItemDraft(unit: UnitCode = 'g'): ItemDraft {
  return { key: newId(), name: '', amount: '', unit, note: '' }
}

export function itemDraftFrom(item: RecipeItem): ItemDraft {
  return {
    key: newId(),
    name: item.name,
    amount: item.amount === 0 ? '' : formatForInput(item.amount),
    unit: item.unit,
    note: item.note ?? '',
  }
}

/** Liest „1,5" genauso wie „1.5"; alles Unlesbare wird zu 0 („nach Gefühl"). */
export function parseAmount(input: string): number {
  const value = Number.parseFloat(input.replace(',', '.').trim())
  return Number.isFinite(value) && value >= 0 ? value : 0
}

function formatForInput(amount: number): string {
  return String(amount).replace('.', ',')
}

/** Vergleichsform für Zutatennamen — „Zwiebeln " und „zwiebeln" sind dasselbe. */
export function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase('de')
}

/**
 * Ordnet jede Formularzeile einem Katalogeintrag zu und legt fehlende an.
 *
 * Der Katalog ist der Grund, warum in der Einkaufsliste nicht „Zwiebel" und
 * „Zwiebeln" nebeneinander stehen: Beide Schreibweisen landen auf derselben
 * Kennung, sobald sie einmal erfasst wurden.
 */
export async function resolveItems(
  drafts: ItemDraft[],
  catalog: Map<string, Ingredient>,
  repository: Repository,
): Promise<RecipeItem[]> {
  const byName = new Map<string, Ingredient>()
  for (const ingredient of catalog.values()) {
    byName.set(normalizeName(ingredient.name), ingredient)
  }

  const items: RecipeItem[] = []
  const created: Ingredient[] = []

  for (const draft of drafts) {
    const name = draft.name.trim()
    if (!name) continue

    const key = normalizeName(name)
    let ingredient = byName.get(key)

    if (!ingredient) {
      ingredient = { id: newId(), name, defaultUnit: draft.unit }
      byName.set(key, ingredient)
      created.push(ingredient)
    }

    items.push({
      ingredientId: ingredient.id,
      name: ingredient.name,
      amount: parseAmount(draft.amount),
      unit: draft.unit,
      note: draft.note.trim() || undefined,
    })
  }

  await Promise.all(created.map((entry) => repository.saveIngredient(entry)))
  return items
}
