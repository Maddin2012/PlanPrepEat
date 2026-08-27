import { describe, expect, it } from 'vitest'
import {
  MAX_CORRECTIONS,
  applyCorrections,
  forgetCorrection,
  learnCorrection,
  toCorrections,
  type Correction,
} from './corrections.ts'

/**
 * Die Liste wird **automatisch** gefüttert — jedes Mal, wenn jemand einen
 * diktierten Namen überschreibt. Deshalb liegt der Schwerpunkt hier nicht auf
 * dem Ersetzen (das ist einfach), sondern darauf, was **nicht** hineingerät.
 * Eine Liste, die Unrat sammelt, macht das Diktat schlechter statt besser.
 */

const FETA: Correction = { gehoert: 'fatham', gemeint: 'Feta' }

describe('applyCorrections', () => {
  it('ersetzt den ganzen Namen', () => {
    expect(applyCorrections('Fatham', [FETA])).toBe('Feta')
  })

  it('achtet nicht auf Groß- und Kleinschreibung', () => {
    expect(applyCorrections('fatham', [FETA])).toBe('Feta')
    expect(applyCorrections('FATHAM', [FETA])).toBe('Feta')
  })

  it('ersetzt auch mitten in einem längeren Namen', () => {
    expect(applyCorrections('Fatham Käse', [FETA])).toBe('Feta Käse')
  })

  it('lässt die Abstände, wie sie sind', () => {
    expect(applyCorrections('Fatham  Käse', [FETA])).toBe('Feta  Käse')
  })

  it('nimmt den Treffer auf den ganzen Namen vor dem auf einzelne Wörter', () => {
    const liste: Correction[] = [
      { gehoert: 'rote zwiebel', gemeint: 'Rote Zwiebeln' },
      { gehoert: 'rote', gemeint: 'Rot' },
    ]
    expect(applyCorrections('rote zwiebel', liste)).toBe('Rote Zwiebeln')
  })

  it('lässt Unbekanntes unverändert', () => {
    expect(applyCorrections('Zwiebeln', [FETA])).toBe('Zwiebeln')
    expect(applyCorrections('Zwiebeln', [])).toBe('Zwiebeln')
  })
})

describe('learnCorrection — was hineinkommt', () => {
  it('nimmt ein Paar auf', () => {
    expect(learnCorrection([], 'Fatham', 'Feta')).toEqual([FETA])
  })

  it('legt das Gehörte kleingeschrieben ab, das Gemeinte wie eingetippt', () => {
    expect(learnCorrection([], '  FATHAM ', '  Feta  ')).toEqual([FETA])
  })

  it('stellt das Neueste nach vorn', () => {
    const liste = learnCorrection([FETA], 'Mozarella', 'Mozzarella')
    expect(liste[0].gemeint).toBe('Mozzarella')
    expect(liste).toHaveLength(2)
  })

  it('ersetzt ein vorhandenes Paar, statt es zu verdoppeln', () => {
    const liste = learnCorrection([FETA], 'Fatham', 'Fetakäse')
    expect(liste).toHaveLength(1)
    expect(liste[0].gemeint).toBe('Fetakäse')
  })
})

describe('learnCorrection — was draußen bleibt', () => {
  it('lernt nichts aus leeren Angaben', () => {
    expect(learnCorrection([], '', 'Feta')).toEqual([])
    expect(learnCorrection([], 'Fatham', '   ')).toEqual([])
  })

  it('lernt keine reine Groß- und Kleinschreibung', () => {
    // Wer „feta" zu „Feta" verbessert, hat nichts über die Erkennung gesagt.
    expect(learnCorrection([], 'feta', 'Feta')).toEqual([])
  })

  it('lernt keine ganzen Sätze', () => {
    // Beim automatischen Lernen der wichtigste Riegel: Wer das Namensfeld
    // komplett neu tippt, füllt sonst die Liste mit Müll.
    const lang = 'Tomaten aus der Dose, geschält und gewürfelt, am besten San Marzano'
    expect(learnCorrection([], lang, 'Tomaten')).toEqual([])
    expect(learnCorrection([], 'Tomaten', lang)).toEqual([])
  })

  it('lässt die alte Liste unangetastet', () => {
    const vorher: Correction[] = [FETA]
    learnCorrection(vorher, 'Mozarella', 'Mozzarella')
    expect(vorher).toEqual([FETA])
  })

  it('wächst nicht über die Obergrenze', () => {
    let liste: Correction[] = []
    for (let i = 0; i < MAX_CORRECTIONS + 20; i += 1) {
      // Die beiden müssen sich wirklich unterscheiden — „wort0" zu „Wort0"
      // wäre nur Großschreibung und würde (richtigerweise) abgelehnt.
      liste = learnCorrection(liste, `falsch${i}`, `Richtig${i}`)
    }
    expect(liste).toHaveLength(MAX_CORRECTIONS)
    // Das Neueste ist noch da, das Älteste ist herausgefallen.
    expect(liste[0].gehoert).toBe(`falsch${MAX_CORRECTIONS + 19}`)
    expect(liste.some((e) => e.gehoert === 'falsch0')).toBe(false)
  })
})

describe('forgetCorrection', () => {
  it('nimmt ein Paar wieder heraus', () => {
    expect(forgetCorrection([FETA], 'Fatham')).toEqual([])
    expect(forgetCorrection([FETA], 'FATHAM')).toEqual([])
  })

  it('lässt die übrigen stehen', () => {
    const liste = [FETA, { gehoert: 'mozarella', gemeint: 'Mozzarella' }]
    expect(forgetCorrection(liste, 'fatham')).toHaveLength(1)
  })
})

describe('toCorrections', () => {
  it('liest eine gültige Liste', () => {
    expect(toCorrections([FETA])).toEqual([FETA])
  })

  it('wirft einzelne kaputte Einträge weg, statt alles zu verwerfen', () => {
    const gemischt = [
      FETA,
      { gehoert: 'nur eins' },
      { gehoert: 7, gemeint: 'Zahl' },
      { gehoert: '  ', gemeint: 'leer' },
      { gehoert: 'mozarella', gemeint: 'Mozzarella' },
    ]
    expect(toCorrections(gemischt)).toHaveLength(2)
  })

  it('lässt Doppelte nicht durch', () => {
    const doppelt = [FETA, { gehoert: 'FATHAM', gemeint: 'Fetakäse' }]
    expect(toCorrections(doppelt)).toHaveLength(1)
  })

  it('verkraftet alles, was keine Liste ist', () => {
    for (const value of [null, undefined, 42, 'text', {}, true]) {
      expect(toCorrections(value)).toEqual([])
    }
  })
})
