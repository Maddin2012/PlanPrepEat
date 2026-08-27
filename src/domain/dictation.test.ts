import { describe, expect, it } from 'vitest'
import { parseSpokenIngredient, splitSpokenSteps } from './dictation.ts'

describe('parseSpokenIngredient', () => {
  it('liest Ziffern mit ausgeschriebener Einheit', () => {
    expect(parseSpokenIngredient('500 Gramm Mehl')).toEqual({
      amount: '500',
      unit: 'g',
      name: 'Mehl',
    })
  })

  it('liest Zahlwörter', () => {
    expect(parseSpokenIngredient('drei Eier')).toEqual({
      amount: '3',
      unit: 'stk',
      name: 'Eier',
    })
  })

  it('nimmt Stück an, wenn eine Zahl ohne Einheit dasteht', () => {
    expect(parseSpokenIngredient('zwei Zwiebeln').unit).toBe('stk')
  })

  it('lässt die Menge leer, wenn keine dasteht', () => {
    // Leer heißt in diesem Formular „nach Gefühl" — genau so ist Salz gemeint.
    expect(parseSpokenIngredient('Salz')).toEqual({
      amount: '',
      unit: 'g',
      name: 'Salz',
    })
  })

  it('kommt mit Kommazahlen zurecht', () => {
    expect(parseSpokenIngredient('1,5 Liter Milch')).toEqual({
      amount: '1,5',
      unit: 'l',
      name: 'Milch',
    })
    expect(parseSpokenIngredient('1.5 Liter Milch').amount).toBe('1,5')
  })

  it('versteht „eine Prise Salz"', () => {
    expect(parseSpokenIngredient('eine Prise Salz')).toEqual({
      amount: '1',
      unit: 'prise',
      name: 'Salz',
    })
  })

  it('versteht halbe Mengen', () => {
    expect(parseSpokenIngredient('ein halbes Kilo Hackfleisch')).toEqual({
      amount: '0,5',
      unit: 'kg',
      name: 'Hackfleisch',
    })
    expect(parseSpokenIngredient('anderthalb Liter Wasser').amount).toBe('1,5')
  })

  it('erkennt abgekürzte Einheiten', () => {
    expect(parseSpokenIngredient('2 EL Olivenöl').unit).toBe('el')
    expect(parseSpokenIngredient('1 TL Zucker').unit).toBe('tl')
    expect(parseSpokenIngredient('250 ml Sahne').unit).toBe('ml')
    expect(parseSpokenIngredient('1 Packung Blätterteig').unit).toBe('pkg')
  })

  it('wirft ein Füllwort nach der Einheit weg', () => {
    expect(parseSpokenIngredient('200 Gramm von dem Käse').name).toBe('Käse')
  })

  it('schreibt den Namen groß, auch wenn die Erkennung klein liefert', () => {
    expect(parseSpokenIngredient('300 gramm mehl').name).toBe('Mehl')
  })

  it('lässt sich von einem Satzpunkt nicht stören', () => {
    expect(parseSpokenIngredient('500 Gramm Mehl.')).toEqual({
      amount: '500',
      unit: 'g',
      name: 'Mehl.',
    })
  })

  it('schiebt Unverstandenes vollständig in den Namen', () => {
    // Der wichtigste Fall: Was schiefgeht, muss sichtbar im Feld stehen und
    // von Hand richtigzustellen sein — nicht halb verschluckt werden.
    const wirr = parseSpokenIngredient('irgendwas völlig anderes')
    expect(wirr.name).toBe('Irgendwas völlig anderes')
    expect(wirr.amount).toBe('')
  })

  it('behält den ganzen Satz, wenn nach der Einheit nichts mehr kommt', () => {
    expect(parseSpokenIngredient('500 Gramm').name).toBe('500 Gramm')
  })

  it('verkraftet leere Eingaben', () => {
    expect(parseSpokenIngredient('')).toEqual({ amount: '', unit: 'g', name: '' })
    expect(parseSpokenIngredient('   ').name).toBe('')
  })
})

describe('splitSpokenSteps', () => {
  it('macht aus einem Satz einen Schritt', () => {
    expect(splitSpokenSteps('Zwiebeln würfeln und anbraten')).toEqual([
      'Zwiebeln würfeln und anbraten',
    ])
  })

  it('trennt an Satzenden', () => {
    expect(
      splitSpokenSteps('Zwiebeln würfeln. Dann anbraten! Und würzen?'),
    ).toEqual(['Zwiebeln würfeln.', 'Dann anbraten!', 'Und würzen?'])
  })

  it('schreibt jeden Schritt groß', () => {
    expect(splitSpokenSteps('zwiebeln würfeln. dann anbraten.')).toEqual([
      'Zwiebeln würfeln.',
      'Dann anbraten.',
    ])
  })

  it('liefert nichts zurück, wenn nichts gesagt wurde', () => {
    expect(splitSpokenSteps('   ')).toEqual([])
  })
})

describe('parseSpokenIngredient — Menge am Ende', () => {
  /**
   * „200 Gramm Tomaten" ging schon immer, „Tomaten 200 Gramm" landete komplett
   * im Namensfeld. Beim Diktieren rutscht einem mal das eine, mal das andere
   * heraus — beides muss ankommen.
   */

  it('versteht Zutat, Menge, Einheit', () => {
    expect(parseSpokenIngredient('Tomaten 200 Gramm')).toEqual({
      amount: '200',
      unit: 'g',
      name: 'Tomaten',
    })
  })

  it('versteht eine Zahl am Ende ohne Einheit als Stück', () => {
    expect(parseSpokenIngredient('Eier 3')).toEqual({
      amount: '3',
      unit: 'stk',
      name: 'Eier',
    })
  })

  it('versteht auch ausgeschriebene Zahlen am Ende', () => {
    expect(parseSpokenIngredient('Zwiebeln zwei')).toEqual({
      amount: '2',
      unit: 'stk',
      name: 'Zwiebeln',
    })
  })

  it('versteht „ein halbes Kilo" am Ende', () => {
    expect(parseSpokenIngredient('Hackfleisch ein halbes Kilo')).toEqual({
      amount: '0,5',
      unit: 'kg',
      name: 'Hackfleisch',
    })
  })

  it('lässt mehrteilige Namen zusammen', () => {
    expect(parseSpokenIngredient('Passierte Tomaten 500 Gramm')).toEqual({
      amount: '500',
      unit: 'g',
      name: 'Passierte Tomaten',
    })
  })

  it('rührt eine Angabe am Anfang nicht an', () => {
    // Steht vorn schon etwas, wird hinten nicht mehr gesucht — sonst risse
    // eine Zahl im Namen die richtige Angabe wieder ein.
    expect(parseSpokenIngredient('500 Gramm Mehl Typ 405')).toEqual({
      amount: '500',
      unit: 'g',
      name: 'Mehl Typ 405',
    })
  })

  it('lässt eine Zutat ohne Menge in Ruhe', () => {
    expect(parseSpokenIngredient('Salz')).toEqual({
      amount: '',
      unit: 'g',
      name: 'Salz',
    })
  })

  it('macht aus einer Menge ohne Zutat keinen leeren Namen', () => {
    // „200 Gramm" allein ist verhört. Dann lieber alles ins Namensfeld,
    // sichtbar und mit zwei Handgriffen zu berichtigen.
    expect(parseSpokenIngredient('200 Gramm').name).toBe('200 Gramm')
  })
})
