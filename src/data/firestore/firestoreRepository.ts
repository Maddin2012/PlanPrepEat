import {
  collection,
  deleteDoc,
  doc,
  documentId,
  endAt,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAt,
  writeBatch,
  type CollectionReference,
  type DocumentReference,
  type Firestore,
} from 'firebase/firestore'
import type {
  ISODate,
  Ingredient,
  PlanEntry,
  PlanSlot,
  Recipe,
  ShoppingState,
} from '../../domain/types.ts'
import {
  normalizeShoppingState,
  planEntryData,
  toPlanEntry,
} from '../../domain/types.ts'
import { toPeople } from '../../domain/people.ts'
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

  // --------------------------------------------------------- Essensplan

  subscribeSlots(
    from: ISODate,
    to: ISODate,
    listener: (slots: PlanSlot[]) => void,
  ): Unsubscribe {
    // Die Schlüssel beginnen mit dem Datum („2026-08-21_lunch"), also ordnet
    // Firestore sie von sich aus chronologisch. Das \uf8ff am Ende steht hinter
    // jedem normalen Zeichen und fängt damit beide Mahlzeiten des letzten Tages
    // noch mit ein — ohne das bliebe „…_dinner" außen vor.
    const range = query(
      this.col('slots'),
      orderBy(documentId()),
      startAt(`${from}_`),
      endAt(`${to}_\uf8ff`),
    )

    return onSnapshot(range, (snapshot) => {
      const slots = snapshot.docs.map((entry) => {
        const raw: unknown = entry.data().entries
        return {
          key: entry.id,
          // Über `toPlanEntry`, nicht von Hand nachgebaut: Ein hier vergessenes
          // Feld verschwände beim Lesen spurlos aus dem Plan.
          entries: (Array.isArray(raw) ? (raw as unknown[]) : [])
            .map(toPlanEntry)
            .filter((item): item is PlanEntry => item !== null),
        }
      })
      listener(slots.sort((a, b) => a.key.localeCompare(b.key)))
    })
  }

  async setSlot(key: string, entries: PlanEntry[]): Promise<void> {
    const ref = doc(this.col('slots'), key)
    if (entries.length === 0) await deleteDoc(ref)
    // Über `planEntryData`, nicht roh: Ein Eintrag ohne Namen trüge sonst ein
    // `undefined` mit sich, und daran bricht Firestore das Schreiben ab.
    else {
      await setDoc(ref, {
        entries: entries.map(planEntryData),
        updatedAt: serverTimestamp(),
      })
    }
  }

  // ----------------------------------------------------------- Einkaufsliste

  subscribeShoppingState(
    listener: (state: ShoppingState) => void,
  ): Unsubscribe {
    return onSnapshot(this.shoppingRef(), (snapshot) => {
      listener(
        normalizeShoppingState(snapshot.exists() ? snapshot.data() : null),
      )
    })
  }

  async saveShoppingState(state: ShoppingState): Promise<void> {
    await setDoc(this.shoppingRef(), state)
  }

  private shoppingRef(): DocumentReference {
    return doc(this.col('shopping'), 'state')
  }

  // ------------------------------------------------------------ Wer isst mit

  /**
   * Die Namen stehen im Haushaltsdokument selbst, nicht in einer eigenen
   * Sammlung: Es sind eine Handvoll Wörter, die zusammen gelesen und zusammen
   * geschrieben werden. Das Feld `members` bleibt davon unberührt — an ihm
   * hängt die Sicherheitsregel.
   */
  subscribePeople(listener: (people: string[]) => void): Unsubscribe {
    return onSnapshot(this.household(), (snapshot) => {
      listener(toPeople(snapshot.exists() ? snapshot.data().people : null))
    })
  }

  async savePeople(people: string[]): Promise<void> {
    await setDoc(this.household(), { people }, { merge: true })
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
