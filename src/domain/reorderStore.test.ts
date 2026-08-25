import { describe, expect, it } from 'vitest'
import { reorderStore } from './aggregate.ts'

/**
 * `reorderStore` schreibt die Ladenreihenfolge fort, wenn jemand die Liste
 * umsortiert. Der Knackpunkt: Sichtbar ist immer nur ein Ausschnitt. Was hier
 * verlorengeht, merkt man erst Wochen später — dann nämlich, wenn eine Zutat
 * wieder eingeplant wird und plötzlich am falschen Ende steht.
 */

describe('reorderStore', () => {
  it('übernimmt die Reihenfolge, wenn es noch keine gibt', () => {
    // Das erste Verschieben überhaupt.
    expect(reorderStore([], ['tomaten', 'wurst', 'kaese'])).toEqual([
      'tomaten',
      'wurst',
      'kaese',
    ])
  })

  it('behält den Platz von Zutaten, die gerade nicht auf der Liste stehen', () => {
    // **Der Kern.** „wurst" ist diese Woche nicht eingeplant. Sie darf ihren
    // Platz zwischen den anderen nicht verlieren, nur weil jemand die
    // sichtbaren Posten umsortiert.
    const gemerkt = ['tomaten', 'wurst', 'kaese']
    const ergebnis = reorderStore(gemerkt, ['kaese', 'tomaten'])

    expect(ergebnis).toContain('wurst')
    expect(ergebnis).toHaveLength(3)
    // Die sichtbaren stehen in der neuen Reihenfolge zueinander.
    expect(ergebnis.indexOf('kaese')).toBeLessThan(ergebnis.indexOf('tomaten'))
  })

  it('dreht zwei sichtbare Posten wirklich um', () => {
    expect(reorderStore(['a', 'b'], ['b', 'a'])).toEqual(['b', 'a'])
  })

  it('hängt neu einsortierte Zutaten an, statt sie zu verschlucken', () => {
    const ergebnis = reorderStore(['a', 'b'], ['a', 'b', 'neu'])
    expect(ergebnis).toEqual(['a', 'b', 'neu'])
  })

  it('nimmt eine neue Zutat auf, die nach vorn gezogen wurde', () => {
    // Sie kann nicht vor „a" landen, solange dort ein unsichtbarer Eintrag
    // klebt — aber sie muss drin sein und vor den anderen sichtbaren stehen.
    const ergebnis = reorderStore(['x', 'a', 'b'], ['neu', 'a', 'b'])
    expect(ergebnis).toContain('neu')
    expect(ergebnis.indexOf('neu')).toBeLessThan(ergebnis.indexOf('a'))
    expect(ergebnis.indexOf('a')).toBeLessThan(ergebnis.indexOf('b'))
  })

  it('erzeugt keine Doppelten', () => {
    const ergebnis = reorderStore(['a', 'b', 'c'], ['c', 'b', 'a'])
    expect(new Set(ergebnis).size).toBe(ergebnis.length)
  })

  it('lässt die gemerkte Runde unberührt, wenn nichts sichtbar ist', () => {
    // Leere Liste (nichts eingeplant): Es gibt nichts umzusortieren.
    expect(reorderStore(['a', 'b', 'c'], [])).toEqual(['a', 'b', 'c'])
  })

  it('überlebt viele Runden, ohne Einträge zu verlieren', () => {
    // Die Sorge bei so einer Fortschreibung ist Abrieb: Nach zwanzig
    // Einkäufen mit wechselnden Rezepten darf nichts abhandengekommen sein.
    const alle = ['a', 'b', 'c', 'd', 'e', 'f']
    let runde = [...alle]

    for (let i = 0; i < 20; i += 1) {
      // Jede Woche ist eine andere Hälfte eingeplant.
      const sichtbar = alle.filter((_, index) => (index + i) % 2 === 0)
      runde = reorderStore(runde, [...sichtbar].reverse())
    }

    expect([...runde].sort()).toEqual([...alle].sort())
  })
})
