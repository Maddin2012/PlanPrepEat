import { describe, expect, it } from 'vitest'
import {
  buildShoppingList,
  collectPlanned,
  liveShoppingKeys,
  manualKey,
  parseManualKey,
  pruneShoppingState,
  shoppingKey,
} from './aggregate.ts'
import { emptyShoppingState } from './types.ts'
import type {
  Ingredient,
  PlanSlot,
  Recipe,
  RecipeItem,
  ShoppingState,
} from './types.ts'

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
        { recipe: a, servings: 2 },
        { recipe: b, servings: 2 },
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
        { recipe: a, servings: 2 },
        { recipe: b, servings: 2 },
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
      [{ recipe: a, servings: 2 }],
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
      [{ recipe: a, servings: 5 }],
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
      [{ recipe: a, servings: 3 }],
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
      [{ recipe: a, servings: 2 }],
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
      [{ recipe: a, servings: 2 }],
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
      [{ recipe: a, servings: 2 }],
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
      [{ recipe: a, servings: 2 }],
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
      [{ recipe: a, servings: 2 }],
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
  const planned = [{ recipe: dreierlei, servings: 2 }]

  const milk = shoppingKey('milk', 'ml')
  const pasta = shoppingKey('pasta', 'g')
  const onion = shoppingKey('onion', 'g')

  // In der Ladenreihenfolge steht die Zutat, nicht der Listenschlüssel.
  const platz = (...ids: string[]) => ids

  const namesOf = (state: ShoppingState) =>
    buildShoppingList(planned, catalog, state).map((item) => item.name)

  it('schiebt Abgehaktes ans Ende', () => {
    expect(
      namesOf({ ...emptyShoppingState(), checked: { [milk]: true } }),
    ).toEqual(['Nudeln', 'Zwiebeln', 'Milch'])
  })

  it('sortiert auch innerhalb der Abgehakten alphabetisch', () => {
    expect(
      namesOf({
        ...emptyShoppingState(),
        checked: { [pasta]: true, [milk]: true },
      }),
    ).toEqual(['Zwiebeln', 'Milch', 'Nudeln'])
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
    const namen = buildShoppingList([{ recipe: inLitern, servings: 2 }], catalog, {
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
        checked: { [onion]: true },
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
  const planned = [{ recipe: a, servings: 2 }]
  const onionKey = shoppingKey('onion', 'g')

  it('übernimmt Häkchen', () => {
    const state: ShoppingState = {
      ...emptyShoppingState(),
      checked: { [onionKey]: true },
    }
    expect(buildShoppingList(planned, catalog, state)[0].checked).toBe(true)
  })

  it('lässt von Hand korrigierte Mengen die berechneten überschreiben', () => {
    const state: ShoppingState = {
      ...emptyShoppingState(),
      overrides: { [onionKey]: 1000 },
    }
    const item = buildShoppingList(planned, catalog, state)[0]
    expect(item.amount).toBe(1000)
    expect(item.edited).toBe(true)
  })

  it('blendet gestrichene Posten aus', () => {
    const state: ShoppingState = {
      ...emptyShoppingState(),
      removed: [onionKey],
    }
    expect(buildShoppingList(planned, catalog, state)).toHaveLength(0)
  })

  it('mischt eigene Posten an der richtigen Stelle ein', () => {
    const state: ShoppingState = {
      ...emptyShoppingState(),
      manual: [{ id: 'm1', name: 'Klopapier', amount: 1, unit: 'pkg' }],
    }
    const list = buildShoppingList(planned, catalog, state)
    expect(list.map((item) => item.name)).toEqual(['Klopapier', 'Zwiebeln'])
    expect(list.find((item) => item.manual)?.name).toBe('Klopapier')
  })

  it('überlebt eine Änderung am Essensplan', () => {
    const state: ShoppingState = {
      checked: { [onionKey]: true },
      overrides: {},
      removed: [],
      manual: [{ id: 'm1', name: 'Klopapier', amount: 1, unit: 'pkg' }],
      storeOrder: [],
    }

    // Ein zweites Rezept kommt in den Plan.
    const b = recipe('b', 'Suppe', 2, [
      { ingredientId: 'pasta', name: 'Nudeln', amount: 100, unit: 'g' },
    ])
    const erweitert = buildShoppingList(
      [...planned, { recipe: b, servings: 2 }],
      catalog,
      state,
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
      checked: { [shoppingKey('onion', 'g')]: true, [manualKey('m1')]: true },
      overrides: { [shoppingKey('weg', 'g')]: 5 },
      removed: [shoppingKey('auch-weg', 'g')],
      manual: [{ id: 'm1', name: 'Klopapier', amount: null, unit: null }],
      storeOrder: ['onion', 'weg', manualKey('m1')],
    }

    const pruned = pruneShoppingState(
      state,
      new Set([shoppingKey('onion', 'g')]),
    )

    expect(pruned.checked).toEqual({
      [shoppingKey('onion', 'g')]: true,
      [manualKey('m1')]: true,
    })
    expect(pruned.overrides).toEqual({})
    expect(pruned.removed).toEqual([])
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

    const pruned = pruneShoppingState(
      state,
      new Set([shoppingKey('onion', 'g')]),
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
    expect(liveShoppingKeys([{ recipe: a, servings: 2 }])).toEqual(
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
