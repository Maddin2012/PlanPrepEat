import { describe, expect, it } from 'vitest'
import {
  categoryRank,
  formatAmount,
  formatNumber,
  normalize,
  prettify,
  roundForShopping,
} from './units.ts'

describe('normalize', () => {
  it('rechnet Kilogramm in Gramm um', () => {
    expect(normalize(1.5, 'kg')).toEqual({ amount: 1500, unit: 'g' })
  })

  it('rechnet Liter in Milliliter um', () => {
    expect(normalize(0.75, 'l')).toEqual({ amount: 750, unit: 'ml' })
  })

  it('lässt Basiseinheiten unverändert', () => {
    expect(normalize(200, 'g')).toEqual({ amount: 200, unit: 'g' })
    expect(normalize(3, 'stk')).toEqual({ amount: 3, unit: 'stk' })
  })

  it('hält EL und TL auseinander, statt sie ineinander umzurechnen', () => {
    expect(normalize(2, 'el').unit).toBe('el')
    expect(normalize(2, 'tl').unit).toBe('tl')
  })
})

describe('prettify', () => {
  it('macht aus 1500 g wieder 1,5 kg', () => {
    expect(prettify(1500, 'g')).toEqual({ amount: 1.5, unit: 'kg' })
  })

  it('macht aus 2000 ml wieder 2 l', () => {
    expect(prettify(2000, 'ml')).toEqual({ amount: 2, unit: 'l' })
  })

  it('lässt Mengen unter 1000 in Ruhe', () => {
    expect(prettify(999, 'g')).toEqual({ amount: 999, unit: 'g' })
  })
})

describe('roundForShopping', () => {
  it('rundet Stückzahlen auf, weil man keine halbe Zwiebel kauft', () => {
    expect(roundForShopping(1.5, 'stk')).toBe(2)
    expect(roundForShopping(2.01, 'stk')).toBe(3)
    expect(roundForShopping(3, 'stk')).toBe(3)
  })

  it('rundet Gramm ab 10 auf ganze Zahlen', () => {
    expect(roundForShopping(333.333, 'g')).toBe(333)
  })

  it('lässt kleinen Mengen eine Nachkommastelle', () => {
    expect(roundForShopping(2.55, 'g')).toBe(2.6)
  })
})

describe('formatAmount', () => {
  it('nutzt das deutsche Dezimalkomma', () => {
    expect(formatAmount(1500, 'g')).toBe('1,5 kg')
  })

  it('schreibt Einheiten aus', () => {
    expect(formatAmount(3, 'stk')).toBe('3 Stück')
    expect(formatAmount(2, 'el')).toBe('2 EL')
  })

  it('kommt ohne Menge aus', () => {
    expect(formatAmount(null, 'pkg')).toBe('Packung')
    expect(formatAmount(null, null)).toBe('')
  })

  it('hängt keine überflüssigen Nullen an', () => {
    expect(formatNumber(2)).toBe('2')
    expect(formatNumber(2.5)).toBe('2,5')
  })
})

describe('categoryRank', () => {
  it('stellt Obst & Gemüse vor Sonstiges', () => {
    expect(categoryRank('produce')).toBeLessThan(categoryRank('other'))
  })
})
