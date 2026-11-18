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
  /**
   * Wo im Plan dieses Rezept steht — siehe `planPosition`.
   *
   * **Ohne diese Angabe wäre die Einkaufsliste blind für den Grund**, aus dem
   * eine Zutat gebraucht wird. Sie sähe nur Mengen, und eine Menge kann nicht
   * sagen, ob die gekauften Nudeln noch im Schrank liegen oder längst gegessen
   * sind.
   */
  position: string
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
    // Dasselbe Rezept darf zweimal auf demselben Platz liegen (zwei Bleche
    // Auflauf). Ohne diesen Zähler trügen beide dieselbe Position, und das
    // zweite zählte als „war schon da".
    const gezaehlt = new Map<string, number>()
    for (const entry of slot.entries) {
      // Freie Einträge („Pizza bestellen") haben keine Zutaten. Ausgesiebt
      // würden sie auch von der Prüfung darunter — ohne `recipeId` findet die
      // Suche ohnehin nichts. Diese Zeile ist trotzdem nötig, damit der
      // Übersetzer die beiden Eintragsformen auseinanderhalten kann.
      if (!isRecipeEntry(entry)) continue
      const recipe = recipesById.get(entry.recipeId)
      // Ein zwischenzeitlich gelöschtes Rezept wird stillschweigend übersprungen.
      if (!recipe) continue
      const wievielte = gezaehlt.get(entry.recipeId) ?? 0
      gezaehlt.set(entry.recipeId, wievielte + 1)
      planned.push({
        recipe,
        servings: entry.servings,
        position: planPosition(slot.key, entry.recipeId, wievielte),
      })
    }
  }
  return planned
}

/**
 * Eine Stelle im Plan: Platz, Rezept und — bei mehrfach belegtem Platz — die
 * wievielte.
 *
 * `slotKey` trennt mit `_`, hier wird mit `|` getrennt; die beiden kommen sich
 * also nicht ins Gehege.
 */
export function planPosition(
  slot: string,
  recipeId: string,
  nth: number,
): string {
  return `${slot}|${recipeId}|${nth}`
}

/** Platz und Rezept aus einer Position zurückholen. */
export function parsePlanPosition(
  position: string,
): { slot: string; recipeId: string } | null {
  const teile = position.split('|')
  if (teile.length !== 3) return null
  return { slot: teile[0], recipeId: teile[1] }
}

interface Bucket {
  key: string
  name: string
  amount: number
  unit: UnitCode
  sources: Set<string>
  positions: Set<string>
}

/** Was sich am Plan getan hat, seit das Häkchen gesetzt wurde. */
export interface PlanChange {
  added: string[]
  gone: string[]
}

/**
 * Vergleicht die beim Abhaken gemerkten Stellen mit den heutigen.
 *
 * `undefined` heißt „nichts gemerkt" — ein Häkchen aus der Zeit vor diesem
 * Feld. Dann gibt es nichts zu vergleichen, und der Aufrufer lässt es stehen.
 */
export function planChange(
  then: readonly string[] | undefined,
  now: ReadonlySet<string>,
): PlanChange | null {
  if (!then) return null
  const damals = new Set(then)
  return {
    added: [...now].filter((position) => !damals.has(position)),
    gone: then.filter((position) => !now.has(position)),
  }
}

/**
 * Ist wirklich ein Gericht **dazugekommen** — oder wurde nur eines verschoben?
 *
 * Verschieben sieht in den Daten genauso aus wie Wegfallen plus Dazukommen:
 * Der Eintrag ist am alten Platz weg und am neuen da. Deshalb wird gepaart,
 * und zwar über das **Rezept**, nicht über die Portionen — eine veränderte
 * Portionszahl fängt der Mengenvergleich ab.
 *
 * Bleibt nach dem Paaren etwas Dazugekommenes übrig, ist es ein neues Gericht,
 * und seine Zutaten gehören auf die Liste. Das ist Martins Regel: Wer ein
 * Rezept einplant, kauft dafür ein — egal, was vorher war.
 */
export function hasNewDish(change: PlanChange | null): boolean {
  if (!change) return false
  const offen = change.gone
    .map((position) => parsePlanPosition(position)?.recipeId)
    .filter((id): id is string => id !== undefined)

  for (const position of change.added) {
    const rezept = parsePlanPosition(position)?.recipeId
    const passend = rezept === undefined ? -1 : offen.indexOf(rezept)
    if (passend === -1) return true
    offen.splice(passend, 1)
  }
  return false
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

  for (const { recipe, servings, position } of planned) {
    for (const item of recipe.items) {
      const scaled = scaleAmount(item.amount, recipe.servings, servings)
      const { amount, unit } = normalize(scaled, item.unit)
      const key = shoppingKey(item.ingredientId, unit)
      const known = ingredients.get(item.ingredientId)

      const bucket = buckets.get(key)
      if (bucket) {
        bucket.amount += amount
        bucket.sources.add(recipe.name)
        bucket.positions.add(position)
      } else {
        buckets.set(key, {
          key,
          name: known?.name ?? item.name,
          amount,
          unit,
          sources: new Set([recipe.name]),
          positions: new Set([position]),
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
 * Zwei Dinge können es fallen lassen:
 *
 * 1. **Ein Gericht ist dazugekommen.** Dann wird für dieses Gericht
 *    eingekauft, und zwar unabhängig von jeder Menge. Das ist die wichtigere
 *    der beiden Regeln und die, die vorher gefehlt hat: Wer Spaghetti gegessen
 *    und danach ein neues Nudelgericht eingeplant hatte, sah die Nudeln nicht
 *    auf der Liste, weil `500 > 500` nun einmal falsch ist. Die Menge weiß
 *    nicht, dass die Nudeln inzwischen im Magen sind — der Plan weiß es.
 * 2. **Es wird mehr gebraucht als beim Abhaken dastand** (Portionen hoch, das
 *    Rezept geändert). Dann sagt `remaining`, was noch fehlt.
 *
 * `remaining` nur, wenn **nichts** aus dem Plan weggefallen ist: Ist ein
 * Gericht verschwunden, wurde sein Einkauf vermutlich verbraucht, und ein
 * Abzug davon wäre geraten. Dann steht die volle Menge da.
 *
 * Ein Gericht, das nur **weggefallen** ist, lässt das Häkchen stehen — gegessen
 * oder abbestellt, gekauft ist es trotzdem.
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

  const wandel = marked
    ? planChange(state.checkedPlan[bucket.key], bucket.positions)
    : null
  const neuesGericht = hasNewDish(wandel)
  const etwasWeg = (wandel?.gone.length ?? 0) > 0

  const bought = state.checkedAmount[bucket.key]
  // Ohne hinterlegte Menge gibt es nichts zu vergleichen: ein Häkchen aus der
  // Zeit vor diesem Feld, oder ein Posten ohne Mengenangabe wie Salz. Beide
  // bleiben abgehakt.
  const comparable =
    marked && typeof bought === 'number' && Number.isFinite(bought)
  const nachschlag = comparable && amount > bought
  const wiederOffen = neuesGericht || nachschlag

  return {
    key: bucket.key,
    name: bucket.name,
    // Menge 0 heißt „ohne Mengenangabe" (z.B. Salz nach Geschmack) und wird
    // in der Liste nur mit dem Namen dargestellt.
    amount: amount === 0 ? null : amount,
    unit: amount === 0 ? null : bucket.unit,
    checked: marked && !wiederOffen,
    edited: hasOverride,
    manual: false,
    sources: [...bucket.sources].sort((a, b) => a.localeCompare(b, 'de')),
    // Gerundet wie jede andere Menge auch — 333,333 g Mehl kauft niemand.
    remaining:
      wiederOffen && nachschlag && !etwasWeg
        ? roundForShopping(amount - bought, bucket.unit)
        : null,
    positions: [...bucket.positions],
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
      // Und er hängt an keinem Rezept, also auch an keiner Stelle im Plan.
      positions: [],
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

/** Ein Gericht, das von einem Platz auf einen anderen gewandert ist. */
export interface MovedDish {
  recipeId: string
  name: string
  /** Platzschlüssel, siehe `slotKey` — vorher und jetzt. */
  from: string
  to: string
  /** Die Zutaten, deren Häkchen daran hängen. */
  keys: string[]
}

/**
 * Die Gerichte, bei denen die App **nicht weiß**, ob eingekauft werden muss.
 *
 * Verschoben und „gegessen, dann neu eingeplant" sehen in den Daten gleich aus:
 * Der Eintrag ist am alten Platz weg und am neuen da. Im ersten Fall liegen die
 * Zutaten noch im Schrank, im zweiten sind sie aufgebraucht. Raten hieße, sich
 * in der Hälfte der Fälle zu irren — deshalb fragt die Oberfläche nach.
 *
 * Gemeldet wird nur, was **abgehakt** ist: Was offen auf der Liste steht,
 * braucht keine Frage.
 */
export function movedDishes(
  planned: PlannedRecipe[],
  ingredients: Map<string, Ingredient>,
  state: ShoppingState,
  today: ISODate = todayISO(),
): MovedDish[] {
  const namen = new Map(planned.map((p) => [p.recipe.id, p.recipe.name]))
  const gefunden = new Map<string, MovedDish>()

  for (const bucket of collectBuckets(planned, ingredients).values()) {
    if (!isMarkActive(state.checked[bucket.key], today)) continue
    const wandel = planChange(state.checkedPlan[bucket.key], bucket.positions)
    if (!wandel) continue

    // Dieselbe Paarung wie in `hasNewDish`: Was sich über das Rezept paaren
    // lässt, ist ein Verschieben. Was übrig bleibt, ist ein neues Gericht und
    // kommt ohne Rückfrage auf die Liste.
    const offen = wandel.gone
      .map((position) => parsePlanPosition(position))
      .filter((p): p is { slot: string; recipeId: string } => p !== null)

    for (const position of wandel.added) {
      const neu = parsePlanPosition(position)
      if (!neu) continue
      const passend = offen.findIndex((alt) => alt.recipeId === neu.recipeId)
      if (passend === -1) continue
      const [alt] = offen.splice(passend, 1)

      const id = `${neu.recipeId}|${alt.slot}|${neu.slot}`
      const schon = gefunden.get(id)
      if (schon) {
        if (!schon.keys.includes(bucket.key)) schon.keys.push(bucket.key)
      } else {
        gefunden.set(id, {
          recipeId: neu.recipeId,
          name: namen.get(neu.recipeId) ?? 'Gericht',
          from: alt.slot,
          to: neu.slot,
          keys: [bucket.key],
        })
      }
    }
  }

  return [...gefunden.values()]
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
    // Aus demselben Grund an `checked` gebunden: Gemerkte Plan-Stellen ohne
    // Häkchen sagen nichts mehr und würden beim nächsten Abhaken gegen einen
    // alten Stand verglichen.
    checkedPlan: pickKeys(state.checkedPlan, (key) => key in checked),
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
