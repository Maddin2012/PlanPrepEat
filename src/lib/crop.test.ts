import { describe, expect, it } from 'vitest'
import { CENTERED, clampView, coverScale, sourceRect } from './crop.ts'

/**
 * Der Ausschnitt wird beim Speichern **fest eingebacken**. Ein Fehler hier
 * lässt sich hinterher nicht mehr geradeziehen — das Foto ist dann so, wie es
 * ist. Der teuerste Fall ist eine weiße Ecke: Sie entsteht, wenn das Bild aus
 * dem Rahmen geschoben werden darf.
 */

const RAHMEN = { width: 320, height: 240 } // 4:3
const QUER = { width: 4000, height: 2000 } // 2:1, breiter als der Rahmen
const HOCH = { width: 1000, height: 2000 } // 1:2, höher als der Rahmen
const PASSEND = { width: 800, height: 600 } // genau 4:3

describe('coverScale', () => {
  it('bedeckt bei einem breiten Bild über die Höhe', () => {
    // 240/2000 = 0,12 — die Breite reichte schon bei 0,08.
    expect(coverScale(QUER, RAHMEN)).toBeCloseTo(0.12)
  })

  it('bedeckt bei einem hohen Bild über die Breite', () => {
    expect(coverScale(HOCH, RAHMEN)).toBeCloseTo(0.32)
  })

  it('trifft bei gleichem Seitenverhältnis genau', () => {
    expect(coverScale(PASSEND, RAHMEN)).toBeCloseTo(0.4)
  })
})

describe('clampView', () => {
  it('lässt ein passendes Bild bei Zoom 1 keinen Millimeter zu', () => {
    // 4:3 in einem 4:3-Rahmen sitzt genau — jede Verschiebung risse eine Ecke auf.
    const view = clampView(
      { zoom: 1, offsetX: 500, offsetY: -500 },
      PASSEND,
      RAHMEN,
    )
    expect(view.offsetX).toBe(0)
    expect(view.offsetY).toBe(0)
  })

  it('erlaubt beim breiten Bild seitliches Spiel, aber kein senkrechtes', () => {
    const view = clampView(
      { zoom: 1, offsetX: 9999, offsetY: 9999 },
      QUER,
      RAHMEN,
    )
    // Bei Zoom 1 ist das Bild 4000*0,12 = 480 breit, der Rahmen 320.
    expect(view.offsetX).toBeCloseTo((480 - 320) / 2)
    expect(view.offsetY).toBe(0)
  })

  it('vergrößert das Spiel mit dem Zoom', () => {
    const eins = clampView({ zoom: 1, offsetX: 9999, offsetY: 0 }, QUER, RAHMEN)
    const zwei = clampView({ zoom: 2, offsetX: 9999, offsetY: 0 }, QUER, RAHMEN)
    expect(zwei.offsetX).toBeGreaterThan(eins.offsetX)
    // Bei Zoom 2: 4000*0,24 = 960 breit, (960-320)/2 = 320.
    expect(zwei.offsetX).toBeCloseTo(320)
  })

  it('zieht einen zu kleinen Zoom auf 1 hoch', () => {
    // Sonst bliebe rundum ein Rand stehen.
    expect(clampView({ ...CENTERED, zoom: 0.3 }, QUER, RAHMEN).zoom).toBe(1)
  })

  it('deckelt den Zoom nach oben', () => {
    expect(clampView({ ...CENTERED, zoom: 99 }, QUER, RAHMEN).zoom).toBe(4)
  })
})

describe('sourceRect', () => {
  /** Liegt der Ausschnitt vollständig im Bild? */
  function drinnen(rect: ReturnType<typeof sourceRect>, image: typeof QUER) {
    return (
      rect.x >= -0.001 &&
      rect.y >= -0.001 &&
      rect.x + rect.width <= image.width + 0.001 &&
      rect.y + rect.height <= image.height + 0.001
    )
  }

  it('hat das Seitenverhältnis des Rahmens', () => {
    const rect = sourceRect(CENTERED, QUER, RAHMEN)
    expect(rect.width / rect.height).toBeCloseTo(320 / 240)
  })

  it('nimmt beim passenden Bild alles', () => {
    const rect = sourceRect(CENTERED, PASSEND, RAHMEN)
    expect(rect).toEqual({ x: 0, y: 0, width: 800, height: 600 })
  })

  it('sitzt ohne Verschiebung mittig', () => {
    const rect = sourceRect(CENTERED, QUER, RAHMEN)
    // Bei 2:1 quer wird links und rechts gleich viel abgeschnitten.
    expect(rect.x).toBeCloseTo((QUER.width - rect.width) / 2)
    expect(rect.y).toBeCloseTo(0)
  })

  it('wandert beim Schieben nach rechts in die rechte Bildhälfte', () => {
    // Die Richtung ist der Fehler, den man am ehesten macht: Ein Vorzeichen
    // verkehrt herum, und der Rahmen zeigt genau das Gegenteil.
    const mitte = sourceRect(CENTERED, QUER, RAHMEN)
    const rechts = sourceRect(
      { zoom: 1, offsetX: -80, offsetY: 0 },
      QUER,
      RAHMEN,
    )
    expect(rechts.x).toBeGreaterThan(mitte.x)
  })

  it('bleibt bei jeder Zumutung im Bild', () => {
    for (const bild of [QUER, HOCH, PASSEND]) {
      for (const zoom of [0.1, 1, 2.5, 99]) {
        for (const offset of [-99999, -50, 0, 50, 99999]) {
          const rect = sourceRect({ zoom, offsetX: offset, offsetY: offset }, bild, RAHMEN)
          expect(drinnen(rect, bild)).toBe(true)
          expect(rect.width).toBeGreaterThan(0)
          expect(rect.height).toBeGreaterThan(0)
        }
      }
    }
  })

  it('zeigt beim Hineinzoomen weniger vom Bild', () => {
    const eins = sourceRect(CENTERED, QUER, RAHMEN)
    const zwei = sourceRect({ ...CENTERED, zoom: 2 }, QUER, RAHMEN)
    expect(zwei.width).toBeCloseTo(eins.width / 2)
    expect(zwei.height).toBeCloseTo(eins.height / 2)
  })
})
