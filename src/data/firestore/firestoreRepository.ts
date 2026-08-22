import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
  type CollectionReference,
  type DocumentReference,
  type Firestore,
} from 'firebase/firestore'
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
 * Firestore-Ablage. Alles hängt unterhalb von `households/{id}`, damit die
 * Security Rules mit einer einzigen Mitgliedsprüfung auskommen und beide
 * Personen exakt denselben Datenbestand sehen.
 */
export class FirestoreRepository implements Repository {
  constructor(
    private readonly db: Firestore,
    readonly householdId: string,
  ) {}

  private household(): DocumentReference {
    return doc(this.db, 'households', this.householdId)
  }

  private col(name: string): CollectionReference {
    return collection(this.household(), name)
  }

  // ---------------------------------------------------------------- Zutaten

  subscribeIngredients(listener: (items: Ingredient[]) => void): Unsubscribe {
    return onSnapshot(this.col('ingredients'), (snapshot) => {
      const items = snapshot.docs.map((entry) => ({
        id: entry.id,
        ...(entry.data() as Omit<Ingredient, 'id'>),
      }))
      listener(items.sort((a, b) => a.name.localeCompare(b.name, 'de')))
    })
  }

  async saveIngredient(ingredient: Ingredient): Promise<void> {
    const { id, ...rest } = ingredient
    await setDoc(doc(this.col('ingredients'), id), rest, { merge: true })
  }

  // ---------------------------------------------------------------- Rezepte

  subscribeRecipes(listener: (recipes: Recipe[]) => void): Unsubscribe {
    return onSnapshot(this.col('recipes'), (snapshot) => {
      const recipes = snapshot.docs.map((entry) =>
        toRecipe(entry.id, entry.data()),
      )
      listener(recipes.sort((a, b) => a.name.localeCompare(b.name, 'de')))
    })
  }

  async loadPhoto(recipeId: string): Promise<string | null> {
    const snapshot = await getDoc(this.photoRef(recipeId))
    return snapshot.exists() ? ((snapshot.data().dataUrl as string) ?? null) : null
  }

  async createRecipe(draft: RecipeDraft, photo: PhotoUpdate): Promise<string> {
    const id = newId()
    const now = Date.now()
    const batch = writeBatch(this.db)

    batch.set(doc(this.col('recipes'), id), {
      ...toRecipeData(draft),
      hasPhoto: typeof photo === 'string',
      createdAt: now,
      updatedAt: now,
    })
    this.queuePhoto(batch, id, photo)

    await batch.commit()
    return id
  }

  async updateRecipe(
    id: string,
    draft: RecipeDraft,
    photo: PhotoUpdate,
  ): Promise<void> {
    const batch = writeBatch(this.db)
    const data: Record<string, unknown> = {
      ...toRecipeData(draft),
      updatedAt: Date.now(),
    }
    // Nur wenn das Foto angefasst wurde, darf das Flag mitgeschrieben werden —
    // sonst würde ein Bearbeiten der Zutaten ein vorhandenes Bild „vergessen".
    if (photo !== undefined) data.hasPhoto = photo !== null

    batch.set(doc(this.col('recipes'), id), data, { merge: true })
    this.queuePhoto(batch, id, photo)
    await batch.commit()
  }

  async deleteRecipe(id: string): Promise<void> {
    const batch = writeBatch(this.db)
    batch.delete(doc(this.col('recipes'), id))
    batch.delete(this.photoRef(id))
    await batch.commit()
  }

  private photoRef(recipeId: string): DocumentReference {
    return doc(this.col('recipes'), recipeId, 'media', 'photo')
  }

  private queuePhoto(
    batch: ReturnType<typeof writeBatch>,
    recipeId: string,
    photo: PhotoUpdate,
  ): void {
    if (photo === undefined) return
    if (photo === null) batch.delete(this.photoRef(recipeId))
    else batch.set(this.photoRef(recipeId), { dataUrl: photo })
  }

  // ------------------------------------------------------------------ Pläne

  subscribePlans(listener: (plans: Plan[]) => void): Unsubscribe {
    return onSnapshot(this.col('plans'), (snapshot) => {
      const plans = snapshot.docs.map((entry) => ({
        id: entry.id,
        startDate: entry.data().startDate as ISODate,
        createdAt: (entry.data().createdAt as number) ?? 0,
      }))
      // Neueste Zeiträume zuerst — man plant fast immer den aktuellen.
      listener(plans.sort((a, b) => b.startDate.localeCompare(a.startDate)))
    })
  }

  async createPlan(startDate: ISODate): Promise<string> {
    // Das Startdatum ist zugleich die Dokument-ID. Legen beide Personen
    // gleichzeitig denselben Zeitraum an, entsteht dadurch nur ein Plan
    // statt zweier konkurrierender.
    await setDoc(
      doc(this.col('plans'), startDate),
      { startDate, createdAt: Date.now() },
      { merge: true },
    )
    return startDate
  }

  async deletePlan(id: string): Promise<void> {
    const planRef = doc(this.col('plans'), id)
    // Firestore löscht Unterordner nicht mit — Plätze und Einkaufszustand
    // müssen einzeln weg, sonst bleiben Waisen liegen.
    const slots = await getDocs(collection(planRef, 'slots'))
    const shopping = await getDocs(collection(planRef, 'shopping'))

    const batch = writeBatch(this.db)
    for (const entry of [...slots.docs, ...shopping.docs]) batch.delete(entry.ref)
    batch.delete(planRef)
    await batch.commit()
  }

  subscribeSlots(
    planId: string,
    listener: (slots: PlanSlot[]) => void,
  ): Unsubscribe {
    return onSnapshot(
      collection(this.col('plans'), planId, 'slots'),
      (snapshot) => {
        const slots = snapshot.docs.map((entry) => ({
          key: entry.id,
          entries: ((entry.data().entries as PlanEntry[]) ?? []).map((item) => ({
            recipeId: item.recipeId,
            servings: item.servings,
          })),
        }))
        listener(slots.sort((a, b) => a.key.localeCompare(b.key)))
      },
    )
  }

  async setSlot(
    planId: string,
    key: string,
    entries: PlanEntry[],
  ): Promise<void> {
    const ref = doc(this.col('plans'), planId, 'slots', key)
    if (entries.length === 0) await deleteDoc(ref)
    else await setDoc(ref, { entries, updatedAt: serverTimestamp() })
  }

  // ----------------------------------------------------------- Einkaufsliste

  subscribeShoppingState(
    planId: string,
    listener: (state: ShoppingState) => void,
  ): Unsubscribe {
    return onSnapshot(this.shoppingRef(planId), (snapshot) => {
      listener(snapshot.exists() ? toShoppingState(snapshot.data()) : emptyShoppingState())
    })
  }

  async saveShoppingState(
    planId: string,
    state: ShoppingState,
  ): Promise<void> {
    await setDoc(this.shoppingRef(planId), state)
  }

  private shoppingRef(planId: string): DocumentReference {
    return doc(this.col('plans'), planId, 'shopping', 'state')
  }
}

function toRecipeData(draft: RecipeDraft): Record<string, unknown> {
  return {
    name: draft.name,
    servings: draft.servings,
    minutes: draft.minutes,
    steps: draft.steps,
    items: draft.items.map((item) => ({
      ingredientId: item.ingredientId,
      name: item.name,
      amount: item.amount,
      unit: item.unit,
      note: item.note,
    })),
    thumb: draft.thumb ?? null,
  }
}

function toRecipe(id: string, data: Record<string, unknown>): Recipe {
  return {
    id,
    name: (data.name as string) ?? '',
    servings: (data.servings as number) ?? 1,
    minutes: (data.minutes as number) ?? 0,
    steps: (data.steps as string) ?? '',
    items: (data.items as Recipe['items']) ?? [],
    thumb: (data.thumb as string | null) ?? undefined,
    hasPhoto: (data.hasPhoto as boolean) ?? false,
    createdAt: (data.createdAt as number) ?? 0,
    updatedAt: (data.updatedAt as number) ?? 0,
  }
}

function toShoppingState(data: Record<string, unknown>): ShoppingState {
  return {
    checked: (data.checked as ShoppingState['checked']) ?? {},
    overrides: (data.overrides as ShoppingState['overrides']) ?? {},
    removed: (data.removed as string[]) ?? [],
    manual: (data.manual as ShoppingState['manual']) ?? [],
  }
}
