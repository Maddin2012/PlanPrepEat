import type {
  ISODate,
  Ingredient,
  Plan,
  PlanEntry,
  PlanSlot,
  Recipe,
  ShoppingState,
} from '../../domain/types.ts'
import { emptyShoppingState } from '../../domain/types.ts'
import type {
  PhotoUpdate,
  RecipeDraft,
  Repository,
  Unsubscribe,
} from '../repository.ts'
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
  private plans = new Map<string, Plan>()
  private slots = new Map<string, Map<string, PlanEntry[]>>()
  private shopping = new Map<string, ShoppingState>()

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

  // ------------------------------------------------------------------ Pläne

  subscribePlans(listener: (plans: Plan[]) => void): Unsubscribe {
    return this.watch(() =>
      listener(
        [...this.plans.values()].sort((a, b) =>
          b.startDate.localeCompare(a.startDate),
        ),
      ),
    )
  }

  async createPlan(startDate: ISODate): Promise<string> {
    const existing = [...this.plans.values()].find(
      (plan) => plan.startDate === startDate,
    )
    if (existing) return existing.id

    const id = newId()
    this.plans.set(id, { id, startDate, createdAt: Date.now() })
    this.commit()
    return id
  }

  async deletePlan(id: string): Promise<void> {
    this.plans.delete(id)
    this.slots.delete(id)
    this.shopping.delete(id)
    this.commit()
  }

  subscribeSlots(
    planId: string,
    listener: (slots: PlanSlot[]) => void,
  ): Unsubscribe {
    return this.watch(() => {
      const map = this.slots.get(planId) ?? new Map<string, PlanEntry[]>()
      listener(
        [...map.entries()]
          .map(([key, entries]) => ({ key, entries: entries.map((e) => ({ ...e })) }))
          .sort((a, b) => a.key.localeCompare(b.key)),
      )
    })
  }

  async setSlot(
    planId: string,
    key: string,
    entries: PlanEntry[],
  ): Promise<void> {
    const map = this.slots.get(planId) ?? new Map<string, PlanEntry[]>()
    if (entries.length === 0) map.delete(key)
    else map.set(key, entries.map((entry) => ({ ...entry })))
    this.slots.set(planId, map)
    this.commit()
  }

  // ----------------------------------------------------------- Einkaufsliste

  subscribeShoppingState(
    planId: string,
    listener: (state: ShoppingState) => void,
  ): Unsubscribe {
    return this.watch(() =>
      listener(this.shopping.get(planId) ?? emptyShoppingState()),
    )
  }

  async saveShoppingState(
    planId: string,
    state: ShoppingState,
  ): Promise<void> {
    this.shopping.set(planId, structuredClone(state))
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
          plans: [...this.plans.values()],
          slots: [...this.slots.entries()].map(([planId, map]) => [
            planId,
            [...map.entries()],
          ]),
          shopping: [...this.shopping.entries()],
        }),
      )
    } catch {
      // Voller localStorage darf die App nicht umbringen — im Probemodus ist
      // der Verlust hinnehmbar, und die Sitzung läuft im Speicher weiter.
    }
  }

  private restore(): void {
    if (!this.storageKey || typeof localStorage === 'undefined') return
    const raw = localStorage.getItem(this.storageKey)
    if (!raw) return
    try {
      const data = JSON.parse(raw)
      for (const item of data.ingredients ?? []) this.ingredients.set(item.id, item)
      for (const item of data.recipes ?? []) this.recipes.set(item.id, item)
      for (const [id, photo] of data.photos ?? []) this.photos.set(id, photo)
      for (const item of data.plans ?? []) this.plans.set(item.id, item)
      for (const [planId, entries] of data.slots ?? []) {
        this.slots.set(planId, new Map(entries))
      }
      for (const [planId, state] of data.shopping ?? []) {
        this.shopping.set(planId, state)
      }
    } catch {
      // Beschädigter Stand: lieber leer starten als gar nicht starten.
    }
  }
}
