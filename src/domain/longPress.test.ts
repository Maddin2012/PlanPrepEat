import { describe, expect, it } from 'vitest'
import {
  LONG_PRESS_MS,
  LONG_PRESS_SLOP,
  isLongPress,
} from './longPress.ts'

describe('isLongPress', () => {
  it('ein kurzer Tipp ist keiner', () => {
    expect(isLongPress({ dx: 0, dy: 0, ms: 120 })).toBe(false)
  })

  it('lang genug und still gehalten ist einer', () => {
    expect(isLongPress({ dx: 2, dy: 3, ms: 700 })).toBe(true)
  })

  it('lang genug, aber verwackelt ist keiner', () => {
    // Hier wird gescrollt, nicht gedrückt.
    expect(isLongPress({ dx: 0, dy: 40, ms: 700 })).toBe(false)
  })

  it('genau auf der Zeitschwelle zählt', () => {
    expect(isLongPress({ dx: 0, dy: 0, ms: LONG_PRESS_MS })).toBe(true)
    expect(isLongPress({ dx: 0, dy: 0, ms: LONG_PRESS_MS - 1 })).toBe(false)
  })

  it('genau auf der Wackelschwelle zählt auch', () => {
    expect(
      isLongPress({ dx: LONG_PRESS_SLOP, dy: 0, ms: 700 }),
    ).toBe(true)
    expect(
      isLongPress({ dx: LONG_PRESS_SLOP + 1, dy: 0, ms: 700 }),
    ).toBe(false)
  })

  it('misst den Abstand, nicht den Weg', () => {
    // Schräg zählt zusammen: 8 und 8 sind über 11 Pixel Abstand.
    expect(isLongPress({ dx: 8, dy: 8, ms: 700 })).toBe(false)
  })

  /**
   * Der Grund, warum sich die beiden Gesten nicht beißen: Ein Wischen braucht
   * mindestens 60 Pixel Weg (`SWIPE_MIN`), ein langer Druck erlaubt 10. Dazwischen
   * liegt genug Luft, dass keine Bewegung beides sein kann.
   */
  it('was ein Wischen wäre, ist nie ein langer Druck', () => {
    expect(isLongPress({ dx: 80, dy: 0, ms: 700 })).toBe(false)
  })
})
