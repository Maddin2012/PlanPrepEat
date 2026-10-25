import { describe, expect, it } from 'vitest'
import { emptyShoppingState } from './types.ts'
import type { ShoppingState } from './types.ts'
import { UNDO_LIMIT, canonical, pushEntry, type UndoEntry } from './undoHistory.ts'

const eintrag = (label: string): UndoEntry => ({
  label,
  state: emptyShoppingState(),
})

describe('pushEntry', () => {
  it('legt den neuesten Stand oben auf', () => {
    const stapel = pushEntry(pushEntry([], eintrag('erst')), eintrag('dann'))
    expect(stapel.map((e) => e.label)).toEqual(['dann', 'erst'])
  })

  it('lässt die übergebene Liste unberührt', () => {
    // Der Stapel wird aus React gelesen; eine von außen veränderte Liste
    // würde dort nicht als Änderung auffallen.
    const vorher = [eintrag('a')]
    pushEntry(vorher, eintrag('b'))
    expect(vorher.map((e) => e.label)).toEqual(['a'])
  })

  it('wirft bei Überlänge den ältesten weg', () => {
    const stapel = pushEntry([eintrag('alt'), eintrag('älter')], eintrag('neu'), 2)
    expect(stapel.map((e) => e.label)).toEqual(['neu', 'alt'])
  })

  it('hält die Obergrenze über viele Schritte', () => {
    let stapel: UndoEntry[] = []
    for (let i = 0; i < UNDO_LIMIT + 15; i += 1) {
      stapel = pushEntry(stapel, eintrag(`schritt ${i}`))
    }
    expect(stapel).toHaveLength(UNDO_LIMIT)
    expect(stapel[0].label).toBe(`schritt ${UNDO_LIMIT + 14}`)
  })
})

describe('canonical', () => {
  const basis: ShoppingState = {
    checked: { 'a|g': '2026-10-23', 'b|g': '2026-10-22' },
    checkedAmount: { 'a|g': 500 },
    overrides: { 'a|g': 500 },
    manual: [{ id: 'm1', name: 'Klopapier', amount: null, unit: null }],
    storeOrder: ['a', 'b', 'c'],
  }

  it('ist gleich, wenn nur die Reihenfolge der Schlüssel anders ist', () => {
    // Genau der Fall nach dem Weg durch Firestore. Ohne das hielte die App
    // ihr eigenes Echo für eine fremde Änderung und würfe den Stapel weg.
    const andersSortiert: ShoppingState = {
      ...basis,
      checked: { 'b|g': '2026-10-22', 'a|g': '2026-10-23' },
    }
    expect(canonical(andersSortiert)).toBe(canonical(basis))
  })

  it('unterscheidet sich, sobald ein Häkchen dazukommt', () => {
    const mehr: ShoppingState = {
      ...basis,
      checked: { ...basis.checked, 'd|g': '2026-10-23' },
    }
    expect(canonical(mehr)).not.toBe(canonical(basis))
  })

  it('unterscheidet sich, sobald ein Häkchen wegfällt', () => {
    expect(canonical({ ...basis, checked: { 'a|g': '2026-10-23' } })).not.toBe(
      canonical(basis),
    )
  })

  it('unterscheidet sich bei anderem Datum derselben Marke', () => {
    expect(
      canonical({ ...basis, checked: { ...basis.checked, 'a|g': '2026-10-01' } }),
    ).not.toBe(canonical(basis))
  })

  it('achtet auf die Reihenfolge der Ladenrunde', () => {
    // Dort **ist** die Reihenfolge der Inhalt — anders als bei den Marken.
    expect(canonical({ ...basis, storeOrder: ['b', 'a', 'c'] })).not.toBe(
      canonical(basis),
    )
  })

  it('achtet auf eigene Posten samt Menge', () => {
    expect(
      canonical({
        ...basis,
        manual: [{ id: 'm1', name: 'Klopapier', amount: 2, unit: 'pkg' }],
      }),
    ).not.toBe(canonical(basis))
  })

  it('erkennt zwei leere Zustände als gleich', () => {
    expect(canonical(emptyShoppingState())).toBe(canonical(emptyShoppingState()))
  })
})
