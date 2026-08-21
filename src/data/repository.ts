import type {
  ISODate,
  Ingredient,
  Plan,
  PlanEntry,
  PlanSlot,
  Recipe,
  ShoppingState,
} from '../domain/types.ts'

export type Unsubscribe = () => void

/**
 * Beim Speichern eines Rezepts: `undefined` lässt ein vorhandenes Foto
 * unberührt, `null` löscht es, ein String setzt ein neues.
 */
export type PhotoUpdate = string | null | undefined

/** Ein Rezept, wie es das Formular abliefert — ohne die von der Ablage
 *  vergebenen Felder id, createdAt und updatedAt. */
export type RecipeDraft = Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>

/**
 * Die einzige Schnittstelle, über die die Oberfläche an Daten kommt.
 *
 * Dahinter steckt in der App Firestore, in Entwicklung und Tests eine
 * In-Memory-Ablage. Diese Trennung ist kein Selbstzweck: Sie hält die App
 * ohne Firebase-Projekt lauffähig, und sie ist der Punkt, an dem ein späterer
 * Umzug auf einen eigenen Server (z.B. Raspberry Pi) ansetzen würde, ohne dass
 * eine einzige Komponente angefasst werden muss.
 *
 * Alle `subscribe*`-Methoden rufen den Callback sofort mit dem aktuellen Stand
 * auf und danach bei jeder Änderung — auch bei Änderungen der anderen Person.
 */
export interface Repository {
  /** Kennung des Haushalts, dessen Daten diese Instanz bedient. */
  readonly householdId: string

  subscribeIngredients(listener: (items: Ingredient[]) => void): Unsubscribe
  saveIngredient(ingredient: Ingredient): Promise<void>

  subscribeRecipes(listener: (recipes: Recipe[]) => void): Unsubscribe
  /** Lädt das Vollbild nach — es liegt getrennt vom Rezept, damit die
   *  Rezeptliste nicht bei jedem Öffnen Megabytes an Bildern zieht. */
  loadPhoto(recipeId: string): Promise<string | null>
  createRecipe(draft: RecipeDraft, photo: PhotoUpdate): Promise<string>
  updateRecipe(
    id: string,
    draft: RecipeDraft,
    photo: PhotoUpdate,
  ): Promise<void>
  deleteRecipe(id: string): Promise<void>

  subscribePlans(listener: (plans: Plan[]) => void): Unsubscribe
  createPlan(startDate: ISODate): Promise<string>
  deletePlan(id: string): Promise<void>

  subscribeSlots(
    planId: string,
    listener: (slots: PlanSlot[]) => void,
  ): Unsubscribe
  /** Leere `entries` löschen den Platz, statt ein leeres Dokument zu hinterlassen. */
  setSlot(planId: string, key: string, entries: PlanEntry[]): Promise<void>

  subscribeShoppingState(
    planId: string,
    listener: (state: ShoppingState) => void,
  ): Unsubscribe
  saveShoppingState(planId: string, state: ShoppingState): Promise<void>
}
