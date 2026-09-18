import { describe, expect, it } from 'vitest'
import type { ShoppingItem } from './types.ts'
import { findByName, sameItemName, suggestNames } from './shoppingNames.ts'

function item(key: string, name: string): ShoppingItem {
  return {
    key,
    name,
    amount: null,
    unit: null,
    checked: false,
    edited: false,
    manual: key.startsWith('manual|'),
    sources: [],
  }
}

const LISTE = [
  item('zutat-avocado|stk', 'Avocado'),
  item('manual|a1', 'Klopapier'),
  item('zutat-creme|ml', 'Saure Creme'),
]

describe('sameItemName', () => {
  it('erkennt denselben Namen anders geschrieben', () => {
    expect(sameItemName('Avocado', 'avocado')).toBe(true)
    expect(sameItemName('  Avocado ', 'AVOCADO')).toBe(true)
    expect(sameItemName('Möhre', 'möhre')).toBe(true)
  })

  it('hält Verschiedenes auseinander', () => {
    // Der wichtigere Fall: Ein zu großzügiger Vergleich verschmölze Posten,
    // die nichts miteinander zu tun haben.
    expect(sameItemName('Avocado', 'Avocadocreme')).toBe(false)
    expect(sameItemName('Avocado', 'Avocados')).toBe(false)
    expect(sameItemName('Salz', 'Pfeffer')).toBe(false)
  })
})

describe('findByName', () => {
  it('findet einen abgeleiteten Posten', () => {
    expect(findByName(LISTE, 'avocado')).toBe('zutat-avocado|stk')
  })

  it('findet auch einen eigenen Posten', () => {
    // Der Fall aus Martins Notiz: von Hand getippt, aber schon vorhanden.
    expect(findByName(LISTE, 'Klopapier')).toBe('manual|a1')
  })

  it('gibt null zurück, wenn es den Namen nicht gibt', () => {
    expect(findByName(LISTE, 'Zebrastreifen')).toBeNull()
  })

  it('gibt bei leerer Eingabe null zurück', () => {
    expect(findByName(LISTE, '   ')).toBeNull()
  })
})

describe('suggestNames — die drei Ränge', () => {
  const NAMEN = ['Avocado', 'Saure Creme', 'Avocadocreme', 'Zwiebeln']

  it('schlägt vor, was so anfängt', () => {
    expect(suggestNames(NAMEN, 'avo')).toEqual(['Avocado', 'Avocadocreme'])
  })

  it('stellt den Wortanfang vor den schwächeren Treffer', () => {
    // „Saure Creme" hat ein Wort, das so anfängt — zweiter Rang. In
    // „Avocadocreme" stecken die Buchstaben nur der Reihe nach, dritter Rang.
    expect(suggestNames(NAMEN, 'creme')).toEqual(['Saure Creme', 'Avocadocreme'])
  })

  it('findet über die Buchstabenfolge — der eigentliche Wunsch', () => {
    // „AVC" steckt der Reihe nach in „Avocado".
    expect(suggestNames(NAMEN, 'AVC')).toContain('Avocado')
    expect(suggestNames(NAMEN, 'zwbl')).toEqual(['Zwiebeln'])
  })

  it('nimmt den besten Rang, wenn nur einer passt', () => {
    expect(suggestNames(NAMEN, 'avocadoc')).toEqual(['Avocadocreme'])
  })

  it('kommt mit Umlauten zurecht', () => {
    expect(suggestNames(['Möhren', 'Milch'], 'moh')).toEqual(['Möhren'])
  })
})

describe('suggestNames — was nicht vorgeschlagen wird', () => {
  it('bei leerer Eingabe nichts', () => {
    expect(suggestNames(['Avocado'], '')).toEqual([])
    expect(suggestNames(['Avocado'], '   ')).toEqual([])
  })

  it('nichts Unpassendes', () => {
    expect(suggestNames(['Avocado', 'Milch'], 'xyz')).toEqual([])
  })

  it('nichts doppelt, auch wenn der Name zweimal hereinkommt', () => {
    // Der Zutatenkatalog und die Liste liefern beide „Avocado".
    expect(suggestNames(['Avocado', 'avocado', 'AVOCADO'], 'avo')).toEqual([
      'Avocado',
    ])
  })

  it('hält die Obergrenze ein', () => {
    const viele = [
      'Apfel',
      'Ananas',
      'Aprikose',
      'Artischocke',
      'Aubergine',
      'Avocado',
    ]
    expect(suggestNames(viele, 'a', 3)).toHaveLength(3)
  })
})
