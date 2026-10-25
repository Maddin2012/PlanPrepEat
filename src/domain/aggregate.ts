import type {
  Ingredient,
  ISODate,
  PlanSlot,
  Recipe,
  ShoppingItem,
  ShoppingState,
  UnitCode,
} from './types.ts'
import { isRecipeEntry } from './types.ts'
import {
  manualKey,
  orderKey,
  parseManualKey,
  shoppingKey,
} from './shoppingKeys.ts'
import { dropExpired, isMarkActive } from './shoppingMarks.ts'
import { todayISO } from './planWindow.ts'
import { normalize, roundForShopping } from './units.ts'
import { scaleAmount } from './scaling.ts'

// Die Schlüssel selbst liegen in shoppingKeys.ts, weil auch types.ts sie
// braucht. Hier weiterreichen, damit die Aufrufer an einer Stelle bleiben.
export { manualKey, orderKey, parseManualKey, shoppingKey } from './shoppingKeys.ts'

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
 * Rechnet die Posten aus den eingeplanten Rezepten zusammen.
 *
 * Eigener Schritt, damit das Zusammenrechnen an **einer** Stelle steht: Welche
 * Zutat in welcher Einheit wie oft vorkommt, entscheidet sich hier und nirgends
 * sonst.
 */
function collectBuckets(
  planned: PlannedRecipe[],
  ingredients: Map<string, Ingredient>,
): Map<string, Bucket> {
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

  return buckets
}

/**
 * Einen zusammengerechneten Posten in die Form der Liste bringen.
 *
 * Hier fällt auch die Entscheidung, ob ein gesetztes Häkchen **noch gilt**.
 * Es klebt an der Zutat, nicht an der Menge — wird später mehr nötig, weil ein
 * weiteres Rezept dieselbe Zutat braucht, war der Posten bisher trotzdem
 * abgehakt und lag unten im Erledigt-Block, nur mit größerer Zahl. Dort sieht
 * niemand nach, wenn der Einkauf als fertig gilt.
 *
 * Deshalb wird die gebrauchte Menge mit der verglichen, die beim Abhaken
 * dastand. Ist sie gewachsen, fällt das Häkchen weg und `remaining` sagt, was
 * noch fehlt. Umgekehrt nicht: Wird **weniger** nötig, weil ein Rezept aus dem
 * Plan verschwindet, bleibt das Häkchen — gekauft ist gekauft.
 */
function toItem(
  bucket: Bucket,
  state: ShoppingState,
  today: ISODate,
): ShoppingItem {
  const override = state.overrides[bucket.key]
  const hasOverride = typeof override === 'number' && Number.isFinite(override)
  const amount = hasOverride
    ? override
    : roundForShopping(bucket.amount, bucket.unit)

  const marked = isMarkActive(state.checked[bucket.key], today)
  const bought = state.checkedAmount[bucket.key]
  // Ohne hinterlegte Menge gibt es nichts zu vergleichen: ein Häkchen aus der
  // Zeit vor diesem Feld, oder ein Posten ohne Mengenangabe wie Salz. Beide
  // bleiben abgehakt.
  const comparable =
    marked && typeof bought === 'number' && Number.isFinite(bought)
  const nachschlag = comparable && amount > bought

  return {
    key: bucket.key,
    name: bucket.name,
    // Menge 0 heißt „ohne Mengenangabe" (z.B. Salz nach Geschmack) und wird
    // in der Liste nur mit dem Namen dargestellt.
    amount: amount === 0 ? null : amount,
    unit: amount === 0 ? null : bucket.unit,
    checked: marked && !nachschlag,
    edited: hasOverride,
    manual: false,
    sources: [...bucket.sources].sort((a, b) => a.localeCompare(b, 'de')),
    // Gerundet wie jede andere Menge auch — 333,333 g Mehl kauft niemand.
    remaining: nachschlag
      ? roundForShopping(amount - bought, bucket.unit)
      : null,
  }
}

/**
 * Baut die Einkaufsliste aus den eingeplanten Rezepten und legt den
 * Nutzer-Zustand darüber: Häkchen, die Menge beim Abhaken, korrigierte Mengen
 * und eigene Einträge. Die berechneten Posten selbst werden nirgends
 * gespeichert, deshalb übersteht der Zustand jede Änderung am Essensplan.
 *
 * Ein Häkchen gilt eine Woche (`shoppingMarks.ts`); `today` entscheidet,
 * welche noch zählen.
 */
export function buildShoppingList(
  planned: PlannedRecipe[],
  ingredients: Map<string, Ingredient>,
  state: ShoppingState,
  today: ISODate = todayISO(),
): ShoppingItem[] {
  const items: ShoppingItem[] = []

  for (const bucket of collectBuckets(planned, ingredients).values()) {
    items.push(toItem(bucket, state, today))
  }

  for (const entry of state.manual) {
    const key = manualKey(entry.id)
    items.push({
      key,
      name: entry.name,
      amount: entry.amount,
      unit: entry.unit,
      checked: isMarkActive(state.checked[key], today),
      edited: false,
      manual: true,
      sources: [],
      // Ein eigener Posten wächst nicht von selbst — seine Menge steht da,
      // weil jemand sie hingeschrieben hat.
      remaining: null,
    })
  }

  return items.sort(shoppingComparator(state.storeOrder))
}

/**
 * Die Reihenfolge der Einkaufsliste, in drei Stufen:
 *
 * 1. Offene Posten vor abgehakten — Erledigtes rutscht nach unten und bleibt
 *    dort durchgestrichen stehen, statt zwischen dem zu stören, was noch fehlt.
 * 2. **Offene** Posten in der **Ladenreihenfolge**: die Runde, die man einmal
 *    von Hand geschoben hat und die seitdem gemerkt wird. Was dort nicht
 *    vorkommt, alphabetisch und hinten dran.
 * 3. **Abgehakte** Posten rein alphabetisch. Die Ladenreihenfolge ist eine
 *    Laufreihenfolge für das, was noch fehlt — was schon im Wagen liegt, sucht
 *    man nach dem Namen, nicht nach dem Regal.
 *
 * Die Runde bleibt für die Abgehakten trotzdem **gemerkt**: Nimmt man ein
 * Häkchen zurück, springt der Posten wieder an seinen Platz in der Runde.
 *
 * Der Index wird einmal als Map vorgebaut, statt bei jedem Vergleich durch das
 * Array zu suchen.
 */
export function shoppingComparator(
  storeOrder: readonly string[] = [],
): (a: ShoppingItem, b: ShoppingItem) => number {
  const nachRunde = byStoreOrder(storeOrder)

  return (a, b) => {
    if (a.checked !== b.checked) return a.checked ? 1 : -1

    // Nur für die offenen Posten: Im Wagen zählt allein der Name.
    if (!a.checked) {
      const runde = nachRunde(a, b)
      if (runde !== 0) return runde
    }

    return a.name.localeCompare(b.name, 'de', { sensitivity: 'base' })
  }
}

/**
 * Vergleicht zwei Posten **nur** nach der gemerkten Ladenreihenfolge.
 *
 * `0` heißt „die Runde weiß hier nichts" — dann entscheidet der Aufrufer
 * weiter, in der Liste also der Name.
 *
 * Eigener Baustein, damit der Vergleich oben in drei lesbaren Stufen steht —
 * und damit diese `0` hier eigene Tests bekommt: Sie ist die stillste Stelle
 * der ganzen Sortierung. Würde man stattdessen die Ränge voneinander abziehen,
 * ergäben zwei unbekannte Posten `Infinity - Infinity`, also `NaN`, und die
 * Liste stünde nach Zufall da.
 */
export function byStoreOrder(
  storeOrder: readonly string[],
): (a: ShoppingItem, b: ShoppingItem) => number {
  const position = new Map(storeOrder.map((key, index) => [key, index]))
  const rank = (item: ShoppingItem) => position.get(orderKey(item.key)) ?? Infinity

  return (a, b) => {
    // Ränge direkt vergleichen statt zu subtrahieren: Bei zwei unbekannten
    // Posten wäre die Differenz NaN, bei bekannt gegen unbekannt unendlich.
    const rankA = rank(a)
    const rankB = rank(b)
    if (rankA === rankB) return 0
    return rankA < rankB ? -1 : 1
  }
}

/**
 * Entfernt Zustand, der zu keinem Posten mehr gehört — etwa das Häkchen einer
 * Zutat, deren Rezept inzwischen aus dem Plan geflogen ist. Ohne das würde ein
 * später wieder eingeplantes Rezept mit bereits gesetzten Häkchen auftauchen.
 *
 * **Die Ladenreihenfolge ist ausgenommen.** Genau daran ist sie vorher
 * gescheitert: Sie wurde bei jeder Änderung auf die gerade sichtbaren Posten
 * zusammengestrichen, und in der Woche darauf standen die Tomaten wieder
 * irgendwo. Eine Zutat behält ihren Platz im Laden, ob sie diese Woche auf der
 * Liste steht oder nicht. Nur eigene Posten fliegen raus, wenn es sie nicht
 * mehr gibt — die kommen nicht wieder.
 *
 * Verfallene Marken fliegen hier ebenfalls raus. Nötig ist das nicht — beim
 * Rechnen werden sie ohnehin übergangen —, es hält nur das Dokument klein.
 */
export function pruneShoppingState(
  state: ShoppingState,
  liveKeys: Set<string>,
  today: ISODate = todayISO(),
): ShoppingState {
  const manualKeys = new Set(state.manual.map((entry) => manualKey(entry.id)))
  const isLive = (key: string) => liveKeys.has(key) || manualKeys.has(key)
  const keepsPlace = (key: string) =>
    parseManualKey(key) === null || manualKeys.has(key)

  const checked = dropExpired(pickKeys(state.checked, isLive), today)

  return {
    checked,
    // An `checked` gebunden statt nur an `isLive`: Eine hinterlegte Menge ohne
    // Häkchen hat keine Bedeutung mehr und würde beim nächsten Abhaken gegen
    // einen alten Stand verglichen. So kann sie ihr Häkchen nicht überleben.
    checkedAmount: pickKeys(state.checkedAmount, (key) => key in checked),
    overrides: pickKeys(state.overrides, isLive),
    manual: state.manual,
    storeOrder: capStoreOrder(state.storeOrder.filter(keepsPlace)),
  }
}

/**
 * Obergrenze für die Ladenreihenfolge.
 *
 * Sie wächst mit jeder je einsortierten Zutat und wird nie kleiner. Bei einem
 * Haushalt sind das ein paar Hundert Einträge — die Grenze ist reine Vorsorge,
 * damit ein jahrelang benutzter Haushalt nicht irgendwann ein Dokument mit
 * Zehntausenden Einträgen mit sich herumträgt. Abgeschnitten wird am **Ende**:
 * Was zuletzt hinten stand, ist am ehesten verzichtbar.
 */
const STORE_ORDER_LIMIT = 2000

function capStoreOrder(keys: string[]): string[] {
  return keys.length > STORE_ORDER_LIMIT ? keys.slice(0, STORE_ORDER_LIMIT) : keys
}

/**
 * Schreibt die Ladenreihenfolge fort, nachdem jemand die Liste umsortiert hat.
 *
 * Der Knackpunkt: Sichtbar ist immer nur ein Ausschnitt. Würde man die
 * Reihenfolge einfach durch die sichtbaren Posten ersetzen, verlöre man den
 * Platz jeder Zutat, die diese Woche nicht dran ist — und wäre wieder da, wo
 * wir hergekommen sind.
 *
 * Deshalb bleiben die **Plätze** stehen und nur ihr Inhalt wird getauscht: Wo
 * in der gemerkten Runde ein sichtbarer Posten stand, steht danach der nächste
 * aus der neuen Reihenfolge. Unsichtbare Einträge behalten ihre Stelle
 * dazwischen. Was mehr ist als Plätze da sind — neu einsortierte Zutaten —
 * hängt sich hinten an.
 */
export function reorderStore(
  storeOrder: readonly string[],
  visibleAfter: readonly string[],
): string[] {
  const visible = new Set(visibleAfter)
  const queue = [...visibleAfter]
  const result: string[] = []

  for (const key of storeOrder) {
    if (visible.has(key)) {
      const next = queue.shift()
      if (next !== undefined) result.push(next)
    } else {
      result.push(key)
    }
  }

  result.push(...queue)
  return capStoreOrder(result)
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
 * Alle Schlüssel, die der aktuelle Plan erzeugt.
 *
 * Daran hängt das Aufräumen: Was hier nicht vorkommt, ist aus dem Plan
 * verschwunden, und sein Häkchen hat keinen Posten mehr, zu dem es gehört.
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
