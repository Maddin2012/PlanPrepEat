import { describe, expect, it } from 'vitest'
import { emptyShoppingState, normalizeShoppingState } from './types.ts'
import { buildShoppingList } from './aggregate.ts'

describe('normalizeShoppingState', () => {
  it('lässt einen gültigen Zustand unverändert', () => {
    const state = {
      checked: { a: '2026-10-20' },
      checkedAmount: { a: 500 },
      overrides: { a: 500 },
      removed: { b: '2026-10-19' },
      manual: [{ id: 'm1', name: 'Klopapier', amount: null, unit: null }],
      storeOrder: ['a', 'b'],
    }
    expect(normalizeShoppingState(state)).toEqual(state)
  })

  /**
   * Der Stand, der am Tag des Updates auf Martins Handy liegt: Häkchen ja,
   * gemerkte Mengen nein. Die Häkchen müssen stehen bleiben — ein Update darf
   * keinen fertigen Einkauf wieder aufmachen.
   */
  it('nimmt einen Stand ohne gemerkte Mengen an und behält die Häkchen', () => {
    const alt = {
      checked: { a: '2026-10-20' },
      overrides: {},
      removed: {},
      manual: [],
      storeOrder: [],
    }
    const neu = normalizeShoppingState(alt)
    expect(neu.checked).toEqual({ a: '2026-10-20' })
    expect(neu.checkedAmount).toEqual({})
  })

  it('wirft unbrauchbare Mengen weg, statt damit zu rechnen', () => {
    const neu = normalizeShoppingState({
      checked: { a: '2026-10-20' },
      checkedAmount: { a: 'viel', b: NaN, c: 300 },
      overrides: {},
      removed: {},
      manual: [],
      storeOrder: [],
    })
    // `NaN > x` ist immer falsch — ein solcher Wert hielte das Häkchen still
    // für immer fest.
    expect(neu.checkedAmount).toEqual({ c: 300 })
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
      checked: { a: '2026-10-20' },
      overrides: {},
      removed: {},
      manual: [],
    }
    expect(normalizeShoppingState(ohneOrder).storeOrder).toEqual([])
    expect(normalizeShoppingState(ohneOrder).checked).toEqual({
      a: '2026-10-20',
    })
  })

  /**
   * Der Stand aus der Zeit vor der Wochenregel: `checked` war eine Zuordnung
   * auf `true`, `removed` eine Liste von Schlüsseln. Beides hatte kein Datum
   * und ist damit sicher älter als eine Woche — es wird verworfen.
   *
   * **Das ist die Reparatur selbst**, nicht ein Nebeneffekt davon: Genau so
   * kommen die Zutaten zurück, die unter der alten Fassung dauerhaft von der
   * Liste verschwunden waren.
   */
  it('verwirft Häkchen und Streichungen ohne Datum', () => {
    const alt = {
      checked: { kartoffeln: true },
      overrides: { kartoffeln: 1000 },
      removed: ['zutat-kartoffeln|stk', 'zutat-zwiebeln|stk'],
      manual: [],
      storeOrder: ['kartoffeln'],
    }
    const sauber = normalizeShoppingState(alt)

    expect(sauber.checked).toEqual({})
    expect(sauber.removed).toEqual({})
    // Was kein Häkchen ist, bleibt erhalten: korrigierte Mengen und die
    // Ladenreihenfolge hat man sich erarbeitet.
    expect(sauber.overrides).toEqual({ kartoffeln: 1000 })
    expect(sauber.storeOrder).toEqual(['kartoffeln'])
  })

  it('wirft kaputte Einträge einzeln weg, statt alles zu verwerfen', () => {
    const gemischt = {
      checked: { gut: '2026-10-20', kaputt: 'ja' },
      overrides: { gut: 5, kaputt: 'viel' },
      removed: { gut: '2026-10-19', kaputt: 7 },
      manual: [{ id: 'm1', name: 'Klopapier' }, { name: 'ohne Kennung' }],
      order: ['gut|g', null],
    }
    const sauber = normalizeShoppingState(gemischt)

    expect(sauber.checked).toEqual({ gut: '2026-10-20' })
    expect(sauber.overrides).toEqual({ gut: 5 })
    expect(sauber.removed).toEqual({ gut: '2026-10-19' })
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
