import { describe, expect, it } from 'vitest'
import { speakableText, toSteps } from './speakable.ts'

/**
 * Zwei Sorten Prüfung stehen hier, und die zweite ist die wichtigere:
 *
 * 1. Die Kürzel werden ausgeschrieben.
 * 2. **Ein normaler Satz bleibt unangetastet.** Eine zu gierige Regel fällt
 *    nicht beim Kürzel auf, sondern mitten in einem harmlosen Satz — und das
 *    merkt man beim Kochen, nicht beim Programmieren.
 */

describe('speakableText — Kürzel ausschreiben', () => {
  it('schreibt Löffel aus', () => {
    expect(speakableText('2 EL Öl erhitzen.')).toBe('2 Esslöffel Öl erhitzen.')
    expect(speakableText('1 TL Salz')).toBe('1 Teelöffel Salz')
  })

  it('schreibt Gewichte und Mengen aus', () => {
    expect(speakableText('200 g Mehl')).toBe('200 Gramm Mehl')
    expect(speakableText('1,5 kg Kartoffeln')).toBe('1,5 Kilogramm Kartoffeln')
    expect(speakableText('250 ml Sahne')).toBe('250 Milliliter Sahne')
    expect(speakableText('1 l Wasser')).toBe('1 Liter Wasser')
  })

  it('trifft die Einzahl', () => {
    expect(speakableText('1 Min. warten')).toBe('1 Minute warten')
    expect(speakableText('20 Min. backen')).toBe('20 Minuten backen')
  })

  it('nimmt nicht die letzte Ziffer für die ganze Zahl', () => {
    // „21" endet auf 1 und ist trotzdem Mehrzahl — daran scheitert jede
    // Regel, die nur die letzte Ziffer ansieht.
    expect(speakableText('21 Min. ruhen lassen')).toBe('21 Minuten ruhen lassen')
  })

  it('macht aus Grad Celsius ein Wort', () => {
    expect(speakableText('bei 180 °C backen')).toBe('bei 180 Grad backen')
    expect(speakableText('auf 200°C vorheizen')).toBe('auf 200 Grad vorheizen')
  })

  it('schreibt die Kürzel ohne Zahl aus', () => {
    expect(speakableText('ca. 20 Min. ziehen lassen')).toBe(
      'circa 20 Minuten ziehen lassen',
    )
    expect(speakableText('Kräuter, z. B. Petersilie')).toBe(
      'Kräuter, zum Beispiel Petersilie',
    )
    expect(speakableText('evtl. nachwürzen')).toBe('eventuell nachwürzen')
  })

  it('verkraftet mehrere Kürzel in einem Satz', () => {
    expect(speakableText('2 EL Öl und 200 g Hack ca. 5 Min. anbraten.')).toBe(
      '2 Esslöffel Öl und 200 Gramm Hack circa 5 Minuten anbraten.',
    )
  })
})

describe('speakableText — was unangetastet bleiben muss', () => {
  it('lässt einen gewöhnlichen Satz in Ruhe', () => {
    const satz = 'Die Zwiebeln schälen und fein würfeln.'
    expect(speakableText(satz)).toBe(satz)
  })

  it('verwechselt den Anfang eines Wortes nicht mit einem Kürzel', () => {
    // „2 Gläser" fängt mit demselben Buchstaben an wie Gramm, „3 Liter"
    // steht schon ausgeschrieben da, und „4 Stangen" nicht mit „Stück"
    // verwandt.
    expect(speakableText('2 Gläser bereitstellen')).toBe('2 Gläser bereitstellen')
    expect(speakableText('3 Liter Wasser')).toBe('3 Liter Wasser')
    expect(speakableText('4 Stangen Lauch')).toBe('4 Stangen Lauch')
  })

  it('rührt eine Zahl ohne Kürzel nicht an', () => {
    expect(speakableText('Den Teig 3 mal falten.')).toBe('Den Teig 3 mal falten.')
  })

  it('lässt Umlaute und Satzzeichen stehen', () => {
    const satz = 'Käse darüberreiben — fertig!'
    expect(speakableText(satz)).toBe(satz)
  })
})

describe('toSteps', () => {
  it('macht aus dem Fließtext eine Liste', () => {
    expect(toSteps('Erst dies.\nDann das.')).toEqual(['Erst dies.', 'Dann das.'])
  })

  it('lässt leere Zeilen weg', () => {
    expect(toSteps('Erst dies.\n\n  \nDann das.')).toEqual([
      'Erst dies.',
      'Dann das.',
    ])
  })

  it('macht aus leerem Text eine leere Liste', () => {
    expect(toSteps('')).toEqual([])
  })
})
