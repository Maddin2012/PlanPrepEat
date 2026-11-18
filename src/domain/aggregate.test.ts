import { describe, expect, it } from 'vitest'
import {
  buildShoppingList,
  hasNewDish,
  movedDishes,
  planChange,
  planPosition,
  byStoreOrder,
  collectPlanned,
  liveShoppingKeys,
  manualKey,
  parseManualKey,
  pruneShoppingState,
  shoppingKey,
} from './aggregate.ts'
import { emptyShoppingState } from './types.ts'
import type { PlannedRecipe } from './aggregate.ts'
import type {
  Ingredient,
  ShoppingItem,
  PlanSlot,
  Recipe,
  RecipeItem,
  ShoppingState,
} from './types.ts'

/**
 * Ein fester Tag für alle Prüfungen. Häkchen und Streichungen verfallen nach
 * einer Woche — ohne festes „heute" hingen die Tests an der Uhr des Rechners,
 * auf dem sie laufen.
 */
const HEUTE = '2026-10-20'
/** Acht Tage später: alles, was an HEUTE gesetzt wurde, ist dann abgelaufen. */
const SPAETER = '2026-10-28'

function ingredient(id: string, name: string): Ingredient {
  return { id, name, defaultUnit: 'g' }
}

function recipe(
  id: string,
  name: string,
  servings: number,
  items: RecipeItem[],
): Recipe {
  return {
    id,
    name,
    servings,
    minutes: 0,
    steps: '',
    items,
    createdAt: 0,
    updatedAt: 0,
  }
}

/**
 * Ein Rezept auf einen Platz im Plan legen.
 *
 * Jeder Aufruf bekommt von selbst einen **eigenen** Platz. Das ist für die
 * meisten Tests gleichgültig, aber nicht für die, die prüfen, ob ein Häkchen
 * noch gilt: Zwei Gerichte an derselben Stelle wären ein Gericht, das zweimal
 * dasteht — und das heißt etwas anderes.
 */
let platzZaehler = 0
function plan(
  recipe: Recipe,
  servings: number,
  slot = `2026-10-2${platzZaehler++ % 10}_dinner`,
  nth = 0,
): PlannedRecipe {
  return { recipe, servings, position: planPosition(slot, recipe.id, nth) }
}

const catalog = new Map<string, Ingredient>([
  ['onion', ingredient('onion', 'Zwiebeln')],
  ['milk', ingredient('milk', 'Milch')],
  ['pasta', ingredient('pasta', 'Nudeln')],
  ['salt', ingredient('salt', 'Salz')],
])

describe('manualKey / parseManualKey', () => {
  it('führt hin und wieder zurück', () => {
    expect(parseManualKey(manualKey('abc123'))).toBe('abc123')
  })

  it('lässt einen abgeleiteten Schlüssel in Ruhe', () => {
    // Daran hängt, wohin eine Änderung geschrieben wird: in den eigenen Posten
    // oder in die Mengen-Korrektur. Eine Verwechslung ginge still schief.
    expect(parseManualKey(shoppingKey('zutat-1', 'g'))).toBeNull()
    expect(parseManualKey('manual|')).toBeNull()
    expect(parseManualKey('')).toBeNull()
  })
})

describe('buildShoppingList', () => {
  it('addiert dieselbe Zutat aus mehreren Rezepten', () => {
    const a = recipe('a', 'Auflauf', 2, [
      { ingredientId: 'onion', name: 'Zwiebeln', amount: 200, unit: 'g' },
    ])
    const b = recipe('b', 'Suppe', 2, [
      { ingredientId: 'onion', name: 'Zwiebeln', amount: 200, unit: 'g' },
    ])

    const list = buildShoppingList(
      [
        plan(a, 2),
        plan(b, 2),
      ],
      catalog,
      emptyShoppingState(),
    )

    expect(list).toHaveLength(1)
    expect(list[0].amount).toBe(400)
    expect(list[0].unit).toBe('g')
    expect(list[0].sources).toEqual(['Auflauf', 'Suppe'])
  })

  it('addiert über Einheitengrenzen hinweg, wenn die Basis dieselbe ist', () => {
    const a = recipe('a', 'Auflauf', 2, [
      { ingredientId: 'milk', name: 'Milch', amount: 0.5, unit: 'l' },
    ])
    const b = recipe('b', 'Pudding', 2, [
      { ingredientId: 'milk', name: 'Milch', amount: 250, unit: 'ml' },
    ])

    const list = buildShoppingList(
      [
        plan(a, 2),
        plan(b, 2),
      ],
      catalog,
      emptyShoppingState(),
    )

    expect(list).toHaveLength(1)
    expect(list[0].amount).toBe(750)
    expect(list[0].unit).toBe('ml')
  })

  it('hält unterschiedliche Einheiten derselben Zutat getrennt', () => {
    const a = recipe('a', 'Auflauf', 2, [
      { ingredientId: 'milk', name: 'Milch', amount: 500, unit: 'ml' },
      { ingredientId: 'milk', name: 'Milch', amount: 2, unit: 'el' },
    ])

    const list = buildShoppingList(
      [plan(a, 2)],
      catalog,
      emptyShoppingState(),
    )

    expect(list).toHaveLength(2)
    expect(list.map((item) => item.unit).sort()).toEqual(['el', 'ml'])
  })

  it('rechnet auf die geplante Portionszahl hoch', () => {
    const a = recipe('a', 'Auflauf', 2, [
      { ingredientId: 'pasta', name: 'Nudeln', amount: 250, unit: 'g' },
    ])

    const list = buildShoppingList(
      [plan(a, 5)],
      catalog,
      emptyShoppingState(),
    )

    expect(list[0].amount).toBe(625)
  })

  it('rundet Stückzahlen so auf, wie man sie kauft', () => {
    const a = recipe('a', 'Auflauf', 2, [
      { ingredientId: 'onion', name: 'Zwiebeln', amount: 1, unit: 'stk' },
    ])

    const list = buildShoppingList(
      [plan(a, 3)],
      catalog,
      emptyShoppingState(),
    )

    // 1 Zwiebel für 2 Portionen, gekocht wird für 3 → 1,5 → aufgerundet 2.
    expect(list[0].amount).toBe(2)
  })

  it('zeigt Zutaten ohne Mengenangabe nur mit Namen', () => {
    const a = recipe('a', 'Auflauf', 2, [
      { ingredientId: 'salt', name: 'Salz', amount: 0, unit: 'prise' },
    ])

    const list = buildShoppingList(
      [plan(a, 2)],
      catalog,
      emptyShoppingState(),
    )

    expect(list[0].amount).toBeNull()
    expect(list[0].unit).toBeNull()
  })

  it('sortiert alphabetisch, solange nichts verschoben wurde', () => {
    const a = recipe('a', 'Auflauf', 2, [
      { ingredientId: 'pasta', name: 'Nudeln', amount: 250, unit: 'g' },
      { ingredientId: 'onion', name: 'Zwiebeln', amount: 1, unit: 'stk' },
      { ingredientId: 'milk', name: 'Milch', amount: 200, unit: 'ml' },
    ])

    const list = buildShoppingList(
      [plan(a, 2)],
      catalog,
      emptyShoppingState(),
    )

    expect(list.map((item) => item.name)).toEqual([
      'Milch',
      'Nudeln',
      'Zwiebeln',
    ])
  })

  it('sortiert unabhängig von Groß- und Kleinschreibung', () => {
    const a = recipe('a', 'Auflauf', 2, [
      { ingredientId: 'x', name: 'zucker', amount: 1, unit: 'g' },
      { ingredientId: 'y', name: 'Äpfel', amount: 1, unit: 'g' },
      { ingredientId: 'z', name: 'Butter', amount: 1, unit: 'g' },
    ])

    const list = buildShoppingList(
      [plan(a, 2)],
      catalog,
      emptyShoppingState(),
    )

    expect(list.map((item) => item.name)).toEqual(['Äpfel', 'Butter', 'zucker'])
  })

  it('nimmt den Namen aus dem Katalog, damit Umbenennungen durchschlagen', () => {
    const a = recipe('a', 'Auflauf', 2, [
      { ingredientId: 'onion', name: 'Zwiebel', amount: 100, unit: 'g' },
    ])

    const list = buildShoppingList(
      [plan(a, 2)],
      catalog,
      emptyShoppingState(),
    )

    expect(list[0].name).toBe('Zwiebeln')
  })

  it('fällt auf den im Rezept gespeicherten Namen zurück', () => {
    const a = recipe('a', 'Auflauf', 2, [
      { ingredientId: 'weg', name: 'Gelöschte Zutat', amount: 100, unit: 'g' },
    ])

    const list = buildShoppingList(
      [plan(a, 2)],
      catalog,
      emptyShoppingState(),
    )

    expect(list[0].name).toBe('Gelöschte Zutat')
  })
})

describe('Reihenfolge der Einkaufsliste', () => {
  const dreierlei = recipe('a', 'Auflauf', 2, [
    { ingredientId: 'milk', name: 'Milch', amount: 200, unit: 'ml' },
    { ingredientId: 'pasta', name: 'Nudeln', amount: 250, unit: 'g' },
    { ingredientId: 'onion', name: 'Zwiebeln', amount: 100, unit: 'g' },
  ])
  const planned = [plan(dreierlei, 2)]

  const milk = shoppingKey('milk', 'ml')
  const pasta = shoppingKey('pasta', 'g')
  const onion = shoppingKey('onion', 'g')

  // In der Ladenreihenfolge steht die Zutat, nicht der Listenschlüssel.
  const platz = (...ids: string[]) => ids

  const namesOf = (state: ShoppingState) =>
    buildShoppingList(planned, catalog, state, HEUTE).map((item) => item.name)

  it('schiebt Abgehaktes ans Ende', () => {
    expect(
      namesOf({ ...emptyShoppingState(), checked: { [milk]: HEUTE } }),
    ).toEqual(['Nudeln', 'Zwiebeln', 'Milch'])
  })

  it('sortiert auch innerhalb der Abgehakten alphabetisch', () => {
    expect(
      namesOf({
        ...emptyShoppingState(),
        checked: { [pasta]: HEUTE, [milk]: HEUTE },
      }),
    ).toEqual(['Zwiebeln', 'Milch', 'Nudeln'])
  })

  /**
   * Martins Wunsch — und die Prüfung, die es vorher nicht gab.
   *
   * Entscheidend ist eine Ladenreihenfolge, die der alphabetischen
   * **widerspricht**. Ohne sie beweist der Test nichts: Bei leerer Runde sind
   * alle Ränge gleich, und dann sortierte schon die alte Fassung nach Namen.
   */
  describe('Abgehaktes gegen eine widersprechende Ladenreihenfolge', () => {
    // Die Runde sagt Nudeln, Zwiebeln, Milch — das Alphabet sagt Milch,
    // Nudeln, Zwiebeln.
    const runde = platz('pasta', 'onion', 'milk')

    it('folgt bei offenen Posten der Runde', () => {
      expect(namesOf({ ...emptyShoppingState(), storeOrder: runde })).toEqual([
        'Nudeln',
        'Zwiebeln',
        'Milch',
      ])
    })

    it('sortiert Abgehaktes nach dem Namen, nicht nach der Runde', () => {
      expect(
        namesOf({
          ...emptyShoppingState(),
          storeOrder: runde,
          checked: { [pasta]: HEUTE, [onion]: HEUTE, [milk]: HEUTE },
        }),
      ).toEqual(['Milch', 'Nudeln', 'Zwiebeln'])
    })

    it('hält beides auseinander, wenn nur ein Teil abgehakt ist', () => {
      // Oben die Runde, unten das Alphabet.
      expect(
        namesOf({
          ...emptyShoppingState(),
          storeOrder: runde,
          checked: { [onion]: HEUTE, [milk]: HEUTE },
        }),
      ).toEqual(['Nudeln', 'Milch', 'Zwiebeln'])
    })
  })

  it('folgt der Ladenreihenfolge', () => {
    expect(
      namesOf({
        ...emptyShoppingState(),
        storeOrder: platz('onion', 'milk', 'pasta'),
      }),
    ).toEqual(['Zwiebeln', 'Milch', 'Nudeln'])
  })

  it('gilt für eine Zutat unabhängig von ihrer Einheit', () => {
    // Der Kern der Umstellung: Gemerkt wird der Platz der *Zutat*. Sonst
    // bekäme „Milch in Litern" einen anderen Platz als „Milch in Millilitern",
    // und ein anderes Rezept schöbe sie quer durch den Laden.
    const inLitern = recipe('b', 'Suppe', 2, [
      { ingredientId: 'milk', name: 'Milch', amount: 1, unit: 'l' },
      { ingredientId: 'onion', name: 'Zwiebeln', amount: 100, unit: 'g' },
    ])
    const namen = buildShoppingList([plan(inLitern, 2)], catalog, {
      ...emptyShoppingState(),
      storeOrder: platz('milk', 'onion'),
    }).map((item) => item.name)

    expect(namen).toEqual(['Milch', 'Zwiebeln'])
  })

  it('hängt später Dazugekommenes alphabetisch hinten an', () => {
    // Nur zwei der drei Posten wurden je verschoben.
    expect(
      namesOf({ ...emptyShoppingState(), storeOrder: platz('onion', 'pasta') }),
    ).toEqual(['Zwiebeln', 'Nudeln', 'Milch'])
  })

  it('lässt das Häkchen schwerer wiegen als die Ladenreihenfolge', () => {
    // Zwiebeln stehen in der Runde ganz vorn, sind aber abgehakt.
    expect(
      namesOf({
        ...emptyShoppingState(),
        storeOrder: platz('onion', 'milk', 'pasta'),
        checked: { [onion]: HEUTE },
      }),
    ).toEqual(['Milch', 'Nudeln', 'Zwiebeln'])
  })

  it('stellt eigene Posten genauso ein wie berechnete', () => {
    const state: ShoppingState = {
      ...emptyShoppingState(),
      manual: [{ id: 'm1', name: 'Klopapier', amount: null, unit: null }],
      storeOrder: [manualKey('m1'), 'onion'],
    }
    expect(namesOf(state)).toEqual([
      'Klopapier',
      'Zwiebeln',
      'Milch',
      'Nudeln',
    ])
  })
})

describe('Nutzer-Zustand über der Liste', () => {
  const a = recipe('a', 'Auflauf', 2, [
    { ingredientId: 'onion', name: 'Zwiebeln', amount: 200, unit: 'g' },
  ])
  const planned = [plan(a, 2)]
  const onionKey = shoppingKey('onion', 'g')

  it('übernimmt Häkchen', () => {
    const state: ShoppingState = {
      ...emptyShoppingState(),
      checked: { [onionKey]: HEUTE },
    }
    expect(buildShoppingList(planned, catalog, state, HEUTE)[0].checked).toBe(true)
  })

  it('lässt von Hand korrigierte Mengen die berechneten überschreiben', () => {
    const state: ShoppingState = {
      ...emptyShoppingState(),
      overrides: { [onionKey]: 1000 },
    }
    const item = buildShoppingList(planned, catalog, state, HEUTE)[0]
    expect(item.amount).toBe(1000)
    expect(item.edited).toBe(true)
  })

  describe('ein Häkchen gilt eine Woche', () => {
    const abgehakt: ShoppingState = {
      ...emptyShoppingState(),
      checked: { [onionKey]: HEUTE },
    }

    it('gilt innerhalb der Woche', () => {
      expect(
        buildShoppingList(planned, catalog, abgehakt, HEUTE)[0].checked,
      ).toBe(true)
    })

    it('ist acht Tage später weg — nicht „schon erledigt" von letzter Woche', () => {
      expect(
        buildShoppingList(planned, catalog, abgehakt, SPAETER)[0].checked,
      ).toBe(false)
    })
  })

  it('mischt eigene Posten an der richtigen Stelle ein', () => {
    const state: ShoppingState = {
      ...emptyShoppingState(),
      manual: [{ id: 'm1', name: 'Klopapier', amount: 1, unit: 'pkg' }],
    }
    const list = buildShoppingList(planned, catalog, state, HEUTE)
    expect(list.map((item) => item.name)).toEqual(['Klopapier', 'Zwiebeln'])
    expect(list.find((item) => item.manual)?.name).toBe('Klopapier')
  })

  it('überlebt eine Änderung am Essensplan', () => {
    const state: ShoppingState = {
      checked: { [onionKey]: HEUTE },
      checkedAmount: {},
      checkedPlan: {},
      overrides: {},
      manual: [{ id: 'm1', name: 'Klopapier', amount: 1, unit: 'pkg' }],
      storeOrder: [],
    }

    // Ein zweites Rezept kommt in den Plan.
    const b = recipe('b', 'Suppe', 2, [
      { ingredientId: 'pasta', name: 'Nudeln', amount: 100, unit: 'g' },
    ])
    const erweitert = buildShoppingList(
      [...planned, plan(b, 2)],
      catalog,
      state,
      HEUTE,
    )

    expect(erweitert.find((item) => item.name === 'Zwiebeln')?.checked).toBe(
      true,
    )
    expect(erweitert.find((item) => item.name === 'Klopapier')).toBeDefined()
    expect(erweitert.find((item) => item.name === 'Nudeln')).toBeDefined()
  })
})

describe('pruneShoppingState', () => {
  it('räumt Zustand weg, dessen Posten aus dem Plan geflogen ist', () => {
    const state: ShoppingState = {
      checked: { [shoppingKey('onion', 'g')]: HEUTE, [manualKey('m1')]: HEUTE },
      checkedAmount: { [shoppingKey('onion', 'g')]: 200 },
      checkedPlan: {},
      overrides: { [shoppingKey('weg', 'g')]: 5 },
      manual: [{ id: 'm1', name: 'Klopapier', amount: null, unit: null }],
      storeOrder: ['onion', 'weg', manualKey('m1')],
    }

    // `HEUTE` muss mit: Ohne festes Datum nimmt `pruneShoppingState` die Uhr
    // des Rechners, und die Häkchen aus diesem Stand wären je nach Tag des
    // Testlaufs abgelaufen oder nicht.
    const pruned = pruneShoppingState(
      state,
      new Set([shoppingKey('onion', 'g')]),
      HEUTE,
    )

    expect(pruned.checked).toEqual({
      [shoppingKey('onion', 'g')]: HEUTE,
      [manualKey('m1')]: HEUTE,
    })
    expect(pruned.overrides).toEqual({})
    expect(pruned.manual).toHaveLength(1)
  })

  it('lässt die Ladenreihenfolge in Ruhe', () => {
    // **Die Kernprobe dieses Pakets.** Vorher wurde hier zusammengestrichen,
    // was gerade nicht auf der Liste stand — und in der Woche darauf standen
    // die Tomaten wieder irgendwo. Eine Zutat behält ihren Platz im Laden,
    // ob sie diese Woche eingeplant ist oder nicht.
    const state: ShoppingState = {
      ...emptyShoppingState(),
      manual: [{ id: 'm1', name: 'Klopapier', amount: null, unit: null }],
      storeOrder: ['onion', 'weg', manualKey('m1')],
    }

    // `HEUTE` muss mit: Ohne festes Datum nimmt `pruneShoppingState` die Uhr
    // des Rechners, und die Häkchen aus diesem Stand wären je nach Tag des
    // Testlaufs abgelaufen oder nicht.
    const pruned = pruneShoppingState(
      state,
      new Set([shoppingKey('onion', 'g')]),
      HEUTE,
    )

    expect(pruned.storeOrder).toEqual(['onion', 'weg', manualKey('m1')])
  })

  it('wirft nur eigene Posten raus, die es nicht mehr gibt', () => {
    // Die kommen nicht wieder — anders als eine Zutat, die nächste Woche
    // wieder eingeplant sein kann.
    const state: ShoppingState = {
      ...emptyShoppingState(),
      manual: [],
      storeOrder: ['onion', manualKey('geloescht'), 'weg'],
    }

    const pruned = pruneShoppingState(state, new Set())
    expect(pruned.storeOrder).toEqual(['onion', 'weg'])
  })
})

describe('liveShoppingKeys', () => {
  it('nennt die Schlüssel in normalisierter Einheit', () => {
    const a = recipe('a', 'Auflauf', 2, [
      { ingredientId: 'milk', name: 'Milch', amount: 1, unit: 'l' },
    ])
    expect(liveShoppingKeys([plan(a, 2)])).toEqual(
      new Set([shoppingKey('milk', 'ml')]),
    )
  })
})

describe('collectPlanned', () => {
  const a = recipe('a', 'Auflauf', 2, [])
  const recipesById = new Map([['a', a]])

  it('zählt ein mehrfach eingeplantes Rezept auch mehrfach', () => {
    const slots: PlanSlot[] = [
      { key: '2026-08-26_lunch', entries: [{ recipeId: 'a', servings: 2 }] },
      { key: '2026-08-27_dinner', entries: [{ recipeId: 'a', servings: 4 }] },
    ]
    expect(collectPlanned(slots, recipesById)).toHaveLength(2)
  })

  it('überspringt ein zwischenzeitlich gelöschtes Rezept', () => {
    const slots: PlanSlot[] = [
      { key: '2026-08-26_lunch', entries: [{ recipeId: 'weg', servings: 2 }] },
    ]
    expect(collectPlanned(slots, recipesById)).toEqual([])
  })

  it('lässt einen freien Eintrag nicht auf die Einkaufsliste', () => {
    // „Pizza bestellen" hat keine Zutaten. Käme der Eintrag hier durch,
    // stolperte die Berechnung über ein Rezept, das es nie gab.
    const slots: PlanSlot[] = [
      {
        key: '2026-08-26_lunch',
        entries: [{ text: 'Pizza bestellen' }, { recipeId: 'a', servings: 2 }],
      },
    ]
    const planned = collectPlanned(slots, recipesById)
    expect(planned).toHaveLength(1)
    expect(planned[0].recipe.id).toBe('a')
  })
})

describe('byStoreOrder', () => {
  const posten = (key: string, name: string): ShoppingItem => ({
    key,
    name,
    amount: null,
    unit: null,
    remaining: null,
    positions: [],
    checked: false,
    edited: false,
    manual: false,
    sources: [],
  })

  const runde = byStoreOrder(['onion', 'milk'])
  const zwiebel = posten(shoppingKey('onion', 'g'), 'Zwiebeln')
  const milch = posten(shoppingKey('milk', 'ml'), 'Milch')
  const nudeln = posten(shoppingKey('pasta', 'g'), 'Nudeln')

  it('sortiert nach der Position in der Runde', () => {
    expect(runde(zwiebel, milch)).toBeLessThan(0)
    expect(runde(milch, zwiebel)).toBeGreaterThan(0)
  })

  it('stellt Bekanntes vor Unbekanntes', () => {
    expect(runde(milch, nudeln)).toBeLessThan(0)
    expect(runde(nudeln, milch)).toBeGreaterThan(0)
  })

  it('gibt bei zwei Unbekannten 0 zurück — dann entscheidet der Name', () => {
    // Nicht NaN: Unendlich minus Unendlich wäre genau das, und eine Sortierung
    // mit NaN liefert eine zufällige Reihenfolge.
    const mehl = posten(shoppingKey('flour', 'g'), 'Mehl')
    expect(runde(nudeln, mehl)).toBe(0)
  })

  it('kennt ohne Runde keine Rangfolge', () => {
    const ohne = byStoreOrder([])
    expect(ohne(zwiebel, milch)).toBe(0)
  })

  it('macht die Einheit nicht zum Unterschied', () => {
    // Die Runde merkt sich die Zutat, nicht den Listenschlüssel: Milch in ml
    // und Milch in EL haben denselben Platz im Laden.
    const milchEL = posten(shoppingKey('milk', 'el'), 'Milch')
    expect(runde(milch, milchEL)).toBe(0)
  })
})

/**
 * Martins Fall vom 25.10.: Der Wocheneinkauf war erledigt und abgehakt, dann
 * kam ein drittes One Pot Pasta in den Plan. Die Nudelmenge wuchs — das
 * Häkchen blieb, und die Zeile lag weiter unten im Erledigt-Block. Dort sieht
 * niemand nach, wenn der Einkauf als fertig gilt.
 */
describe('Nachschlag: mehr nötig als beim Abhaken', () => {
  const nudelKey = shoppingKey('pasta', 'g')
  const pasta = (id: string, gramm: number) =>
    recipe(id, 'One Pot Pasta', 2, [
      { ingredientId: 'pasta', name: 'Nudeln', amount: gramm, unit: 'g' },
    ])

  /** Zwei Mal eingeplant, 1000 g gekauft und abgehakt. */
  const nachDemEinkauf: ShoppingState = {
    ...emptyShoppingState(),
    checked: { [nudelKey]: HEUTE },
    checkedAmount: { [nudelKey]: 1000 },
  }

  const liste = (anzahl: number, state: ShoppingState) =>
    buildShoppingList(
      Array.from({ length: anzahl }, (_, i) =>
        plan(pasta(`r${i}`, 500), 2),
      ),
      catalog,
      state,
      HEUTE,
    )

  it('öffnet den Posten wieder und sagt, wie viel noch fehlt', () => {
    const [nudeln] = liste(3, nachDemEinkauf)
    expect(nudeln.checked).toBe(false)
    // Die Gesamtmenge bleibt stehen, der Nachschlag kommt dazu.
    expect(nudeln.amount).toBe(1500)
    expect(nudeln.remaining).toBe(500)
  })

  it('lässt das Häkchen stehen, solange nicht mehr nötig ist', () => {
    const [nudeln] = liste(2, nachDemEinkauf)
    expect(nudeln.checked).toBe(true)
    expect(nudeln.remaining).toBeNull()
  })

  it('lässt das Häkchen auch stehen, wenn weniger nötig wird', () => {
    // Ein Rezept fliegt aus dem Plan. Gekauft ist gekauft.
    const [nudeln] = liste(1, nachDemEinkauf)
    expect(nudeln.checked).toBe(true)
    expect(nudeln.remaining).toBeNull()
  })

  /**
   * Der Stand am Tag des Updates: Häkchen aus der Zeit vor diesem Feld. Ohne
   * hinterlegte Menge gibt es nichts zu vergleichen — und ein geratener Wert
   * wäre schlimmer als keiner, weil er einen fertigen Einkauf aufmachte.
   */
  it('lässt ein Häkchen ohne hinterlegte Menge in Ruhe', () => {
    const alt: ShoppingState = {
      ...emptyShoppingState(),
      checked: { [nudelKey]: HEUTE },
    }
    const [nudeln] = liste(3, alt)
    expect(nudeln.checked).toBe(true)
    expect(nudeln.remaining).toBeNull()
  })

  it('rührt Zutaten ohne Mengenangabe nicht an', () => {
    // Salz hat keine Zahl, die wachsen könnte — und es ist im Haus.
    const salzig = (id: string) =>
      recipe(id, 'Suppe', 2, [
        { ingredientId: 'salt', name: 'Salz', amount: 0, unit: 'g' },
      ])
    const state: ShoppingState = {
      ...emptyShoppingState(),
      checked: { [shoppingKey('salt', 'g')]: HEUTE },
    }
    const [salz] = buildShoppingList(
      [
        plan(salzig('s1'), 2),
        plan(salzig('s2'), 2),
      ],
      catalog,
      state,
      HEUTE,
    )
    expect(salz.amount).toBeNull()
    expect(salz.checked).toBe(true)
    expect(salz.remaining).toBeNull()
  })

  it('wirft die gemerkte Menge weg, sobald das Häkchen weg ist', () => {
    const gekuerzt = pruneShoppingState(
      { ...nachDemEinkauf, checked: {} },
      new Set([nudelKey]),
      HEUTE,
    )
    expect(gekuerzt.checkedAmount).toEqual({})
  })

  it('wirft sie auch weg, wenn das Häkchen verfallen ist', () => {
    const gekuerzt = pruneShoppingState(
      nachDemEinkauf,
      new Set([nudelKey]),
      SPAETER,
    )
    expect(gekuerzt.checked).toEqual({})
    expect(gekuerzt.checkedAmount).toEqual({})
  })
})

/**
 * Martins Meldung vom 18.11.: „Die Nudeln wurden nicht mit reingenommen, weil
 * wir gerade erst Spaghetti gegessen haben."
 *
 * Der Einkauf war erledigt und die Nudeln abgehakt. Dann kam ein neues
 * Nudelgericht in den Plan — und blieb unsichtbar, weil die alte Regel nur
 * Mengen verglich: `500 > 500` ist falsch, also galt das Häkchen weiter. Dass
 * die gekauften Nudeln längst gegessen waren, konnte die Menge nicht wissen.
 */
describe('Ein neu eingeplantes Gericht holt seine Zutaten zurück', () => {
  const nudelKey = shoppingKey('pasta', 'g')
  const SPAGHETTI = '2026-10-19_dinner'
  const AUFLAUF = '2026-10-22_dinner'

  const nudelrezept = (id: string, name: string) =>
    recipe(id, name, 2, [
      { ingredientId: 'pasta', name: 'Nudeln', amount: 500, unit: 'g' },
    ])
  const spaghetti = nudelrezept('spag', 'Spaghetti')
  const auflauf = nudelrezept('aufl', 'Nudelauflauf')

  /** Nach dem Einkauf: 500 g gekauft, abgehakt, damals stand nur Spaghetti da. */
  const nachDemEinkauf: ShoppingState = {
    ...emptyShoppingState(),
    checked: { [nudelKey]: HEUTE },
    checkedAmount: { [nudelKey]: 500 },
    checkedPlan: { [nudelKey]: [planPosition(SPAGHETTI, 'spag', 0)] },
  }

  it('Martins Fall: Spaghetti gegessen, Auflauf neu eingeplant', () => {
    const [nudeln] = buildShoppingList(
      [
        // Das gekochte Spaghetti steht weiter auf seinem Tag im Plan.
        plan(spaghetti, 2, SPAGHETTI),
        plan(auflauf, 2, AUFLAUF),
      ],
      catalog,
      nachDemEinkauf,
      HEUTE,
    )
    expect(nudeln.checked).toBe(false)
    expect(nudeln.amount).toBe(1000)
    expect(nudeln.remaining).toBe(500)
  })

  it('auch wenn das alte Gericht aus dem Plan gefallen ist', () => {
    // Dann ist nichts abzuziehen: Der Einkauf wurde verbraucht, es steht die
    // volle Menge da. `500 > 500` wäre falsch — trotzdem muss die Zeile offen
    // sein, und genau daran ist die alte Regel gescheitert.
    const [nudeln] = buildShoppingList(
      [plan(auflauf, 2, AUFLAUF)],
      catalog,
      nachDemEinkauf,
      HEUTE,
    )
    expect(nudeln.checked).toBe(false)
    expect(nudeln.amount).toBe(500)
    expect(nudeln.remaining).toBeNull()
  })

  it('auch wenn das neue Gericht weniger braucht als gekauft wurde', () => {
    // Die Großpackung: 1 kg gekauft, das neue Gericht will 500 g. Die Menge
    // spricht dagegen, der Plan dafür — und der Plan hat recht, denn gegessen
    // ist gegessen.
    const [nudeln] = buildShoppingList(
      [plan(auflauf, 2, AUFLAUF)],
      catalog,
      { ...nachDemEinkauf, checkedAmount: { [nudelKey]: 1000 } },
      HEUTE,
    )
    expect(nudeln.checked).toBe(false)
    expect(nudeln.remaining).toBeNull()
  })

  it('dasselbe Rezept ein zweites Mal zählt als neues Gericht', () => {
    const [nudeln] = buildShoppingList(
      [plan(spaghetti, 2, SPAGHETTI), plan(spaghetti, 2, AUFLAUF)],
      catalog,
      nachDemEinkauf,
      HEUTE,
    )
    expect(nudeln.checked).toBe(false)
  })

  it('zweimal am selben Platz ebenso — zwei Bleche sind zwei Gerichte', () => {
    const [nudeln] = buildShoppingList(
      [plan(spaghetti, 2, SPAGHETTI), plan(spaghetti, 2, SPAGHETTI, 1)],
      catalog,
      nachDemEinkauf,
      HEUTE,
    )
    expect(nudeln.checked).toBe(false)
  })

  it('ein bloß weggefallenes Gericht lässt das Häkchen stehen', () => {
    // Gegessen oder abbestellt — gekauft ist es trotzdem.
    const [nudeln] = buildShoppingList(
      [plan(auflauf, 2, AUFLAUF)],
      catalog,
      {
        ...nachDemEinkauf,
        checkedPlan: {
          [nudelKey]: [
            planPosition(SPAGHETTI, 'spag', 0),
            planPosition(AUFLAUF, 'aufl', 0),
          ],
        },
        checkedAmount: { [nudelKey]: 1000 },
      },
      HEUTE,
    )
    expect(nudeln.checked).toBe(true)
  })

  it('ein verschobenes Gericht lässt das Häkchen stehen — die Frage kommt extra', () => {
    const verschoben = [plan(spaghetti, 2, AUFLAUF)]
    const [nudeln] = buildShoppingList(
      verschoben,
      catalog,
      nachDemEinkauf,
      HEUTE,
    )
    expect(nudeln.checked).toBe(true)

    const gemeldet = movedDishes(verschoben, catalog, nachDemEinkauf, HEUTE)
    expect(gemeldet).toHaveLength(1)
    expect(gemeldet[0]).toMatchObject({
      recipeId: 'spag',
      name: 'Spaghetti',
      from: SPAGHETTI,
      to: AUFLAUF,
      keys: [nudelKey],
    })
  })

  it('bei einem neuen Gericht wird nicht gefragt', () => {
    const gemeldet = movedDishes(
      [plan(spaghetti, 2, SPAGHETTI), plan(auflauf, 2, AUFLAUF)],
      catalog,
      nachDemEinkauf,
      HEUTE,
    )
    expect(gemeldet).toEqual([])
  })

  /**
   * Der Stand am Tag des Updates: Häkchen ja, gemerkte Plan-Stellen nein. Ein
   * Update darf keinen fertigen Einkauf wieder aufmachen.
   */
  it('lässt ein Häkchen ohne gemerkte Plan-Stellen in Ruhe', () => {
    const [nudeln] = buildShoppingList(
      [plan(spaghetti, 2, SPAGHETTI), plan(auflauf, 2, AUFLAUF)],
      catalog,
      {
        ...emptyShoppingState(),
        checked: { [nudelKey]: HEUTE },
        checkedAmount: { [nudelKey]: 1000 },
      },
      HEUTE,
    )
    expect(nudeln.checked).toBe(true)
  })

  it('wirft die gemerkten Stellen weg, sobald das Häkchen weg ist', () => {
    const gekuerzt = pruneShoppingState(
      { ...nachDemEinkauf, checked: {} },
      new Set([nudelKey]),
      HEUTE,
    )
    expect(gekuerzt.checkedPlan).toEqual({})
  })
})

describe('planChange und hasNewDish', () => {
  const a0 = planPosition('2026-10-20_dinner', 'a', 0)
  const a1 = planPosition('2026-10-21_dinner', 'a', 0)
  const b0 = planPosition('2026-10-21_dinner', 'b', 0)

  it('ohne gemerkten Stand gibt es nichts zu vergleichen', () => {
    expect(planChange(undefined, new Set([a0]))).toBeNull()
    expect(hasNewDish(null)).toBe(false)
  })

  it('nennt Dazugekommenes und Weggefallenes', () => {
    expect(planChange([a0], new Set([a1, b0]))).toEqual({
      added: [a1, b0],
      gone: [a0],
    })
  })

  it('ein anderes Rezept ist ein neues Gericht', () => {
    expect(hasNewDish(planChange([a0], new Set([a0, b0])))).toBe(true)
  })

  it('dasselbe Rezept an anderer Stelle ist ein Verschieben', () => {
    expect(hasNewDish(planChange([a0], new Set([a1])))).toBe(false)
  })

  it('verschoben **und** eines dazu bleibt ein neues Gericht', () => {
    expect(hasNewDish(planChange([a0], new Set([a1, b0])))).toBe(true)
  })

  it('nur weggefallen ist kein neues Gericht', () => {
    expect(hasNewDish(planChange([a0, b0], new Set([a0])))).toBe(false)
  })
})
