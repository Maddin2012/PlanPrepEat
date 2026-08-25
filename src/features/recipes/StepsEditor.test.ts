import { describe, expect, it } from 'vitest'
import { emptyStep, stepsFromText, stepsToText } from './StepsEditor.tsx'

/**
 * Die Schlüssel sind neu dazugekommen, damit sich Schritte verschieben lassen.
 * Sie dürfen aber nichts am Gespeicherten ändern — sonst hätte das Verschieben
 * die Rezepte angefasst, die es gar nicht betrifft.
 */

describe('stepsFromText / stepsToText', () => {
  it('führt Text unverändert wieder zu Text zurück', () => {
    const text = 'Zwiebeln würfeln.\nSpeck auslassen.\nAlles vermengen.'
    expect(stepsToText(stepsFromText(text))).toBe(text)
  })

  it('gibt jedem Schritt einen eigenen Schlüssel', () => {
    // Zwei gleiche Schlüssel und React zeichnete beim Verschieben Unsinn.
    const steps = stepsFromText('Erster.\nZweiter.\nDritter.')
    expect(new Set(steps.map((step) => step.key)).size).toBe(3)
  })

  it('vergibt auch bei gleichlautenden Schritten verschiedene Schlüssel', () => {
    const steps = stepsFromText('Umrühren.\nUmrühren.')
    expect(steps[0].key).not.toBe(steps[1].key)
  })

  it('lässt aus leerem Text ein einzelnes leeres Feld entstehen', () => {
    // Ohne Schritt stünde man vor einem Formular ohne Eingabefeld.
    const steps = stepsFromText('')
    expect(steps).toHaveLength(1)
    expect(steps[0].text).toBe('')
  })

  it('wirft leere Schritte beim Speichern weg', () => {
    const steps = [emptyStep('Erster.'), emptyStep('  '), emptyStep('Zweiter.')]
    expect(stepsToText(steps)).toBe('Erster.\nZweiter.')
  })

  it('schneidet Leerraum an den Rändern ab', () => {
    expect(stepsToText([emptyStep('  Anbraten.  ')])).toBe('Anbraten.')
  })

  it('macht aus lauter leeren Schritten einen leeren Text', () => {
    expect(stepsToText([emptyStep(), emptyStep()])).toBe('')
  })
})
