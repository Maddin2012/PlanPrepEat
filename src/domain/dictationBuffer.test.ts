import { describe, expect, it } from 'vitest'
import { dictationBuffer } from './dictationBuffer.ts'

describe('dictationBuffer', () => {
  it('ist am Anfang leer', () => {
    expect(dictationBuffer().text()).toBe('')
  })

  /**
   * Martins Fall: „fünfhundert Gramm" — Pause — „Mehl". Vorher wurden daraus
   * zwei Zutaten, weil die Pause die Grenze zog.
   */
  it('hängt zwei getrennte Äußerungen zu einem Text zusammen', () => {
    const puffer = dictationBuffer()
    puffer.absorb('500 Gramm')
    puffer.absorb('Mehl')
    expect(puffer.text()).toBe('500 Gramm Mehl')
  })

  it('hängt auch drei und mehr zusammen', () => {
    const puffer = dictationBuffer()
    puffer.absorb('Zwiebeln würfeln.')
    puffer.absorb('Dann anbraten.')
    puffer.absorb('Und würzen.')
    expect(puffer.text()).toBe('Zwiebeln würfeln. Dann anbraten. Und würzen.')
  })

  /**
   * Chrome auf Android meldet Zwischenstände als endgültig und liefert sie
   * wachsend nach. Ohne diese Erkennung stünde dreimal dasselbe da.
   */
  it('zählt wachsende Fassungen derselben Äußerung nur einmal', () => {
    const puffer = dictationBuffer()
    puffer.absorb('500')
    puffer.absorb('500 g')
    puffer.absorb('500 g Mehl')
    expect(puffer.text()).toBe('500 g Mehl')
  })

  it('lässt eine kürzer gemeldete Wiederholung den Stand nicht verkürzen', () => {
    // Nach einem Neustart kommt der Satz mitunter verkürzt wieder.
    const puffer = dictationBuffer()
    puffer.absorb('500 g Mehl')
    puffer.absorb('500 g')
    expect(puffer.text()).toBe('500 g Mehl')
  })

  it('erkennt dieselbe Äußerung unabhängig von Groß- und Kleinschreibung', () => {
    const puffer = dictationBuffer()
    puffer.absorb('mehl')
    puffer.absorb('Mehl type 405')
    expect(puffer.text()).toBe('Mehl type 405')
  })

  it('übergeht leere Eingaben', () => {
    const puffer = dictationBuffer()
    puffer.absorb('Mehl')
    puffer.absorb('   ')
    puffer.absorb('')
    expect(puffer.text()).toBe('Mehl')
  })

  describe('take', () => {
    it('gibt alles zurück und fängt von vorn an', () => {
      const puffer = dictationBuffer()
      puffer.absorb('500 Gramm')
      puffer.absorb('Mehl')
      expect(puffer.take()).toBe('500 Gramm Mehl')
      expect(puffer.text()).toBe('')
    })

    it('trennt die nächste Zutat von der vorigen', () => {
      const puffer = dictationBuffer()
      puffer.absorb('500 Gramm Mehl')
      puffer.take()
      puffer.absorb('zwei Zwiebeln')
      expect(puffer.text()).toBe('zwei Zwiebeln')
    })

    it('gibt auf leerem Puffer einen leeren Text', () => {
      expect(dictationBuffer().take()).toBe('')
    })

    it('verwechselt nach der Grenze nichts mit dem Vorigen', () => {
      // „Mehl" und „Mehl" wären verwandte Äußerungen — nach der Grenze darf
      // das aber nicht mehr zusammenfallen, sonst verschwände die zweite Zutat.
      const puffer = dictationBuffer()
      puffer.absorb('Mehl')
      expect(puffer.take()).toBe('Mehl')
      puffer.absorb('Mehl')
      expect(puffer.text()).toBe('Mehl')
    })
  })
})
