import { describe, expect, it } from 'vitest'
import {
  SWIPE_MAX_MS,
  SWIPE_MIN,
  nextTab,
  swipeVerdict,
} from './swipe.ts'

/**
 * Die wichtigeren Tests sind hier die **negativen**. Dass ein sauberer Wisch
 * erkannt wird, merkt man beim ersten Ausprobieren; dass ein schräges Scrollen
 * den Reiter wechselt, merkt man erst, wenn es beim Einkaufen passiert und die
 * halb abgehakte Liste weg ist.
 */

const TABS = ['/rezepte', '/plan', '/einkaufsliste']

describe('swipeVerdict — was ein Wischen ist', () => {
  it('erkennt nach links', () => {
    expect(swipeVerdict({ dx: -120, dy: 10, ms: 200 })).toBe('links')
  })

  it('erkennt nach rechts', () => {
    expect(swipeVerdict({ dx: 120, dy: -10, ms: 200 })).toBe('rechts')
  })

  it('nimmt es auch leicht schräg an', () => {
    // 100 waagerecht zu 40 senkrecht ist eindeutig genug.
    expect(swipeVerdict({ dx: -100, dy: 40, ms: 300 })).toBe('links')
  })
})

describe('swipeVerdict — was keines ist', () => {
  it('lässt senkrechtes Scrollen in Ruhe', () => {
    expect(swipeVerdict({ dx: 0, dy: -300, ms: 300 })).toBeNull()
    expect(swipeVerdict({ dx: 8, dy: -300, ms: 300 })).toBeNull()
  })

  it('lässt überwiegend senkrechtes Schräg-Scrollen in Ruhe', () => {
    // Genau der Fall, der beim Scrollen mit dem Daumen ständig vorkommt.
    expect(swipeVerdict({ dx: -90, dy: -120, ms: 300 })).toBeNull()
  })

  it('ignoriert ein Wackeln beim Tippen', () => {
    expect(swipeVerdict({ dx: -20, dy: 2, ms: 80 })).toBeNull()
  })

  it('ignoriert langsames Ziehen', () => {
    expect(swipeVerdict({ dx: -200, dy: 0, ms: SWIPE_MAX_MS + 1 })).toBeNull()
  })

  it('trifft die Schwellen genau', () => {
    // Knapp darunter zählt nicht, genau darauf schon.
    expect(swipeVerdict({ dx: -(SWIPE_MIN - 1), dy: 0, ms: 200 })).toBeNull()
    expect(swipeVerdict({ dx: -SWIPE_MIN, dy: 0, ms: 200 })).toBe('links')
    expect(swipeVerdict({ dx: -100, dy: 0, ms: SWIPE_MAX_MS })).toBe('links')
  })

  it('nimmt eine Bewegung ohne Weg nicht an', () => {
    expect(swipeVerdict({ dx: 0, dy: 0, ms: 0 })).toBeNull()
  })
})

describe('nextTab', () => {
  it('geht nach links einen weiter', () => {
    expect(nextTab(TABS, '/rezepte', 'links')).toBe('/plan')
    expect(nextTab(TABS, '/plan', 'links')).toBe('/einkaufsliste')
  })

  it('geht nach rechts einen zurück', () => {
    expect(nextTab(TABS, '/einkaufsliste', 'rechts')).toBe('/plan')
    expect(nextTab(TABS, '/plan', 'rechts')).toBe('/rezepte')
  })

  it('bricht am Rand nicht um', () => {
    // Wer im Kreis landet, weiß nicht mehr, wo er ist.
    expect(nextTab(TABS, '/rezepte', 'rechts')).toBeNull()
    expect(nextTab(TABS, '/einkaufsliste', 'links')).toBeNull()
  })

  it('lässt einen Pfad in Ruhe, der gar kein Reiter ist', () => {
    // Im Rezept oder in den Einstellungen gibt es kein „einen weiter".
    expect(nextTab(TABS, '/rezepte/abc123', 'links')).toBeNull()
    expect(nextTab(TABS, '/einstellungen', 'links')).toBeNull()
  })
})
