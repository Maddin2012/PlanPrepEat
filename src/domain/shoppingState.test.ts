import { describe, expect, it } from 'vitest'
import { emptyShoppingState, normalizeShoppingState } from './types.ts'
import { buildShoppingList } from './aggregate.ts'

describe('normalizeShoppingState', () => {
  it('lässt einen gültigen Zustand unverändert', () => {
    const state = {
      checked: { a: true },
      overrides: { a: 500 },
      removed: ['b'],
      manual: [{ id: 'm1', name: 'Klopapier', amount: null, unit: null }],
      storeOrder: ['a', 'b'],
    }
    expect(normalizeShoppingState(state)).toEqual(state)
  })

  it('macht aus dem alten Format einen leeren Zustand', () => {
    // Vor dem fortlaufenden Kalender lag hier eine Liste von
    // [Zeitraum, Zustand]-Paaren. Genau daran ist die Einkaufsliste mit
    // „state.manual is not iterable" abgestürzt und der Reiter blieb weiß.
    const alt = [
      ['2026-08-19', { checked: {}, overrides: {}, removed: [], manual: [] }],
    ]
    expect(normalizeShoppingState(alt)).toEqual(emptyShoppingState())
  })

  it('verkraftet null, undefined und Unsinn', () => {
    for (const value of [null, undefined, 42, 'text', true, []]) {
      expect(normalizeShoppingState(value)).toEqual(emptyShoppingState())
    }
  })

  it('ergänzt fehlende Felder einzeln', () => {
    // Ein Stand von vor der freien Sortierung kennt die Ladenrunde nicht.
    const ohneOrder = {
      checked: { a: true },
      overrides: {},
      removed: [],
      manual: [],
    }
    expect(normalizeShoppingState(ohneOrder).storeOrder).toEqual([])
    expect(normalizeShoppingState(ohneOrder).checked).toEqual({ a: true })
  })

  it('wirft kaputte Einträge einzeln weg, statt alles zu verwerfen', () => {
    const gemischt = {
      checked: { gut: true, kaputt: 'ja' },
      overrides: { gut: 5, kaputt: 'viel' },
      removed: ['gut', 7],
      manual: [{ id: 'm1', name: 'Klopapier' }, { name: 'ohne Kennung' }],
      order: ['gut|g', null],
    }
    const sauber = normalizeShoppingState(gemischt)

    expect(sauber.checked).toEqual({ gut: true })
    expect(sauber.overrides).toEqual({ gut: 5 })
    expect(sauber.removed).toEqual(['gut'])
    expect(sauber.manual).toHaveLength(1)
    // Der alte Schlüssel „gut|g" wird dabei auf seine Zutat zurückgeführt.
    expect(sauber.storeOrder).toEqual(['gut'])
  })

  it('liefert einen Zustand, mit dem die Einkaufsliste rechnen kann', () => {
    // Der eigentliche Punkt: Was hier herauskommt, darf buildShoppingList
    // unter keinen Umständen zum Absturz bringen.
    const ausAlterFassung = normalizeShoppingState([['2026-08-19', {}]])
    expect(() =>
      buildShoppingList([], new Map(), ausAlterFassung),
    ).not.toThrow()
  })
})
