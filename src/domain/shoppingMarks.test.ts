import { describe, expect, it } from 'vitest'
import {
  MARK_DAYS,
  clearMark,
  dropExpired,
  isMarkActive,
  setMark,
  toMarkMap,
} from './shoppingMarks.ts'

const HEUTE = '2026-10-20'

describe('isMarkActive', () => {
  it('gilt am Tag, an dem sie gesetzt wurde', () => {
    expect(isMarkActive(HEUTE, HEUTE)).toBe(true)
  })

  it('gilt sechs Tage später noch', () => {
    expect(isMarkActive('2026-10-14', HEUTE)).toBe(true)
  })

  it('ist nach genau einer Woche abgelaufen', () => {
    // Die Grenze ausdrücklich geprüft: Genau hier entscheidet sich, ob die
    // Kartoffeln nächste Woche wieder auf der Liste stehen.
    expect(isMarkActive('2026-10-13', HEUTE)).toBe(false)
  })

  it('ist acht Tage später erst recht abgelaufen', () => {
    expect(isMarkActive('2026-10-12', HEUTE)).toBe(false)
  })

  it('gilt auch mit einem Datum in der Zukunft', () => {
    // Das zweite Gerät im Haushalt kann vorgehen; eine gerade gesetzte Marke
    // darf nicht sofort verfallen.
    expect(isMarkActive('2026-10-25', HEUTE)).toBe(true)
  })

  it('gilt nicht ohne oder mit krummem Datum', () => {
    expect(isMarkActive(undefined, HEUTE)).toBe(false)
    expect(isMarkActive('', HEUTE)).toBe(false)
    expect(isMarkActive('irgendwann', HEUTE)).toBe(false)
    expect(isMarkActive('20.10.2026', HEUTE)).toBe(false)
  })

  it('läuft über einen Monatswechsel richtig', () => {
    // Textvergleich allein würde hier genügen, Datumsrechnung ist der Teil,
    // der schiefgehen kann: 28. Oktober plus sieben Tage ist im November.
    expect(isMarkActive('2026-10-28', '2026-11-03')).toBe(true)
    expect(isMarkActive('2026-10-28', '2026-11-04')).toBe(false)
  })
})

describe('setMark und clearMark', () => {
  it('setzt und entfernt, ohne das Alte anzufassen', () => {
    const vorher: Record<string, string> = { a: '2026-10-01' }
    const mit = setMark(vorher, 'b', HEUTE)
    expect(mit).toEqual({ a: '2026-10-01', b: HEUTE })
    expect(vorher).toEqual({ a: '2026-10-01' })

    const ohne = clearMark(mit, 'a')
    expect(ohne).toEqual({ b: HEUTE })
    expect(mit.a).toBe('2026-10-01')
  })

  it('überschreibt eine vorhandene Marke mit dem neuen Tag', () => {
    expect(setMark({ a: '2026-10-01' }, 'a', HEUTE)).toEqual({ a: HEUTE })
  })

  it('verkraftet das Entfernen einer Marke, die es nicht gibt', () => {
    expect(clearMark({ a: HEUTE }, 'b')).toEqual({ a: HEUTE })
  })
})

describe('dropExpired', () => {
  it('behält nur, was noch gilt', () => {
    expect(
      dropExpired({ frisch: '2026-10-18', alt: '2026-09-01' }, HEUTE),
    ).toEqual({ frisch: '2026-10-18' })
  })
})

describe('toMarkMap', () => {
  it('liest einen gespeicherten Stand', () => {
    expect(toMarkMap({ a: HEUTE, b: '2026-01-02' })).toEqual({
      a: HEUTE,
      b: '2026-01-02',
    })
  })

  it('verwirft die alte Form von „removed" — eine Liste', () => {
    // Genau dadurch kommen Martins Kartoffeln zurück.
    expect(toMarkMap(['zutat-kartoffeln|stk'])).toEqual({})
  })

  it('verwirft die alte Form von „checked" — true', () => {
    expect(toMarkMap({ a: true, b: false })).toEqual({})
  })

  it('wirft einzelne krumme Einträge weg, nicht den ganzen Stand', () => {
    expect(toMarkMap({ gut: HEUTE, krumm: 'gestern', zahl: 7 })).toEqual({
      gut: HEUTE,
    })
  })

  it('verkraftet alles, was kein Objekt ist', () => {
    expect(toMarkMap(null)).toEqual({})
    expect(toMarkMap(undefined)).toEqual({})
    expect(toMarkMap('a')).toEqual({})
    expect(toMarkMap(7)).toEqual({})
  })
})

describe('MARK_DAYS', () => {
  it('ist eine Woche', () => {
    expect(MARK_DAYS).toBe(7)
  })
})
