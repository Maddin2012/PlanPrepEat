import { describe, expect, it } from 'vitest'
import {
  buildShoppingList,
  collectPlanned,
  groupByCategory,
  liveShoppingKeys,
  manualKey,
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

function ingredient(
  id: string,
  name: string,
  category: Ingredient['category'] = 'other',
): Ingredient {
  return { id, name, category, defaultUnit: 'g' }
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
    tags: [],
    steps: '',
    items,
    createdAt: 0,
    updatedAt: 0,
  }
}

const catalog = new Map<string, Ingredient>([
  ['onion', ingredient('onion', 'Zwiebeln', 'produce')],
  ['milk', ingredient('milk', 'Milch', 'dairy')],
  ['pasta', ingredient('pasta', 'Nudeln', 'pantry')],
  ['salt', ingredient('salt', 'Salz', 'pantry')],
])

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

  it('sortiert nach Supermarkt-Abteilung', () => {
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

    expect(list.map((item) => item.category)).toEqual([
      'produce',
      'dairy',
      'pantry',
    ])
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
    expect(list[0].category).toBe('other')
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
      manual: [
        {
          id: 'm1',
          name: 'Klopapier',
          amount: 1,
          unit: 'pkg',
          category: 'household',
        },
      ],
    }
    const list = buildShoppingList(planned, catalog, state)
    expect(list.map((item) => item.name)).toEqual(['Zwiebeln', 'Klopapier'])
    expect(list[1].manual).toBe(true)
  })

  it('überlebt eine Änderung am Essensplan', () => {
    const state: ShoppingState = {
      checked: { [onionKey]: true },
      overrides: {},
      removed: [],
      manual: [
        {
          id: 'm1',
          name: 'Klopapier',
          amount: 1,
          unit: 'pkg',
          category: 'household',
        },
      ],
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
      manual: [
        { id: 'm1', name: 'Klopapier', amount: null, unit: null, category: 'household' },
      ],
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
})

describe('groupByCategory', () => {
  it('fasst aufeinanderfolgende Abteilungen zusammen', () => {
    const a = recipe('a', 'Auflauf', 2, [
      { ingredientId: 'onion', name: 'Zwiebeln', amount: 100, unit: 'g' },
      { ingredientId: 'pasta', name: 'Nudeln', amount: 100, unit: 'g' },
      { ingredientId: 'salt', name: 'Salz', amount: 1, unit: 'prise' },
    ])
    const groups = groupByCategory(
      buildShoppingList([{ recipe: a, servings: 2 }], catalog, emptyShoppingState()),
    )
    expect(groups.map((group) => group.category)).toEqual(['produce', 'pantry'])
    expect(groups[1].items).toHaveLength(2)
  })
})
