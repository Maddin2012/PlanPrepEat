import type {
  ISODate,
  Ingredient,
  PlanEntry,
  PlanSlot,
  Recipe,
  ShoppingState,
} from '../../domain/types.ts'
import {
  emptyShoppingState,
  normalizeShoppingState,
  toPlanEntry,
} from '../../domain/types.ts'
import type {
  PhotoUpdate,
  RecipeDraft,
  Repository,
  Unsubscribe,
} from '../repository.ts'
import { toPeople } from '../../domain/people.ts'
import { newId } from '../ids.ts'

/**
 * Ablage im Arbeitsspeicher, gespiegelt nach localStorage.
 *
 * Sie bedient dieselbe Schnittstelle wie der Firestore-Adapter und hält die App
 * damit ohne Firebase-Projekt voll benutzbar — für die Entwicklung, für Tests
 * und als „Probemodus", in dem man die App ansehen kann, bevor man sich um die
 * Einrichtung kümmert. Was hier landet, bleibt auf diesem einen Gerät.
 */
export class MemoryRepository implements Repository {
  readonly householdId: string

  private ingredients = new Map<string, Ingredient>()
  private recipes = new Map<string, Recipe>()
  private photos = new Map<string, string>()
  private slots = new Map<string, PlanEntry[]>()
  private shopping: ShoppingState | null = null
  private people: string[] = []

  private listeners = new Set<() => void>()
  private storageKey: string | null

  constructor(householdId = 'probe', options: { persist?: boolean } = {}) {
    this.householdId = householdId
    this.storageKey =
      options.persist === false ? null : `rezeptbuch:${householdId}`
    this.restore()
  }

  // ---------------------------------------------------------------- Zutaten

  subscribeIngredients(listener: (items: Ingredient[]) => void): Unsubscribe {
    return this.watch(() =>
      listener(
        [...this.ingredients.values()].sort((a, b) =>
          a.name.localeCompare(b.name, 'de'),
        ),
      ),
    )
  }

  async saveIngredient(ingredient: Ingredient): Promise<void> {
    this.ingredients.set(ingredient.id, { ...ingredient })
    this.commit()
  }

  // ---------------------------------------------------------------- Rezepte

  subscribeRecipes(listener: (recipes: Recipe[]) => void): Unsubscribe {
    return this.watch(() =>
      listener(
        [...this.recipes.values()].sort((a, b) =>
          a.name.localeCompare(b.name, 'de'),
        ),
      ),
    )
  }

  async loadPhoto(recipeId: string): Promise<string | null> {
    return this.photos.get(recipeId) ?? null
  }

  async createRecipe(draft: RecipeDraft, photo: PhotoUpdate): Promise<string> {
    const id = newId()
    const now = Date.now()
    this.recipes.set(id, {
      ...draft,
      id,
      createdAt: now,
      updatedAt: now,
      hasPhoto: typeof photo === 'string',
    })
    this.applyPhoto(id, photo)
    this.commit()
    return id
  }

  async updateRecipe(
    id: string,
    draft: RecipeDraft,
    photo: PhotoUpdate,
  ): Promise<void> {
    const existing = this.recipes.get(id)
    if (!existing) return
    this.applyPhoto(id, photo)
    this.recipes.set(id, {
      ...draft,
      id,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
      hasPhoto: this.photos.has(id),
    })
    this.commit()
  }

  async deleteRecipe(id: string): Promise<void> {
    this.recipes.delete(id)
    this.photos.delete(id)
    this.commit()
  }

  private applyPhoto(recipeId: string, photo: PhotoUpdate): void {
    if (photo === undefined) return
    if (photo === null) this.photos.delete(recipeId)
    else this.photos.set(recipeId, photo)
  }

  // --------------------------------------------------------- Essensplan

  subscribeSlots(
    from: ISODate,
    to: ISODate,
    listener: (slots: PlanSlot[]) => void,
  ): Unsubscribe {
    return this.watch(() => {
      // Die Schlüssel beginnen mit dem Datum, ein Textvergleich reicht also
      // für die Bereichsprüfung — dieselbe Eigenschaft nutzt der
      // Firestore-Adapter für seine Abfrage.
      listener(
        [...this.slots.entries()]
          .filter(([key]) => key >= `${from}_` && key <= `${to}_￿`)
          .map(([key, entries]) => ({
            key,
            entries: entries.map((entry) => ({ ...entry })),
          }))
          .sort((a, b) => a.key.localeCompare(b.key)),
      )
    })
  }

  async setSlot(key: string, entries: PlanEntry[]): Promise<void> {
    if (entries.length === 0) this.slots.delete(key)
    else this.slots.set(key, entries.map((entry) => ({ ...entry })))
    this.commit()
  }

  // ----------------------------------------------------------- Einkaufsliste

  subscribeShoppingState(
    listener: (state: ShoppingState) => void,
  ): Unsubscribe {
    return this.watch(() => listener(this.shopping ?? emptyShoppingState()))
  }

  async saveShoppingState(state: ShoppingState): Promise<void> {
    this.shopping = structuredClone(state)
    this.commit()
  }

  // ------------------------------------------------------------ Wer isst mit

  subscribePeople(listener: (people: string[]) => void): Unsubscribe {
    return this.watch(() => listener([...this.people]))
  }

  async savePeople(people: string[]): Promise<void> {
    this.people = [...people]
    this.commit()
  }

  // ------------------------------------------------------------------ intern

  private watch(emit: () => void): Unsubscribe {
    emit()
    this.listeners.add(emit)
    return () => {
      this.listeners.delete(emit)
    }
  }

  private commit(): void {
    this.persist()
    for (const listener of [...this.listeners]) listener()
  }

  private persist(): void {
    if (!this.storageKey || typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify({
          ingredients: [...this.ingredients.values()],
          recipes: [...this.recipes.values()],
          photos: [...this.photos.entries()],
          slots: [...this.slots.entries()],
          shopping: this.shopping,
          people: this.people,
        }),
      )
    } catch {
      // Voller localStorage darf die App nicht umbringen — im Probemodus ist
      // der Verlust hinnehmbar, und die Sitzung läuft im Speicher weiter.
    }
  }

  /**
   * Liest den gespeicherten Stand ein.
   *
   * Was hier ankommt, kann aus einer älteren Fassung der App stammen — vor dem
   * fortlaufenden Kalender lagen die Plätze nach Zeitraum gruppiert und der
   * Einkaufszustand als Liste von Paaren vor. Solche Einträge passen nicht mehr
   * und werden verworfen, statt später beim Rendern zu explodieren. Rezepte,
   * Zutaten und Fotos haben ihr Format nie geändert und bleiben erhalten.
   */
  private restore(): void {
    if (!this.storageKey || typeof localStorage === 'undefined') return
    const raw = localStorage.getItem(this.storageKey)
    if (!raw) return

    try {
      const data = JSON.parse(raw)

      for (const item of asArray(data.ingredients)) {
        if (item?.id) this.ingredients.set(item.id, item)
      }
      for (const item of asArray(data.recipes)) {
        if (item?.id) this.recipes.set(item.id, item)
      }
      for (const pair of asArray(data.photos)) {
        if (Array.isArray(pair) && typeof pair[0] === 'string') {
          this.photos.set(pair[0], pair[1])
        }
      }

      for (const pair of asArray(data.slots)) {
        if (!Array.isArray(pair) || !isSlotKey(pair[0])) continue
        const entries = asArray(pair[1])
          .map(toPlanEntry)
          .filter((entry): entry is PlanEntry => entry !== null)
        if (entries.length > 0) this.slots.set(pair[0], entries)
      }

      this.shopping = data.shopping
        ? normalizeShoppingState(data.shopping)
        : null
      this.people = toPeople(data.people)
    } catch {
      // Beschädigter Stand: lieber leer starten als gar nicht starten.
    }
  }
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : []
}

function isSlotKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}_(lunch|dinner)$/.test(value)
}


