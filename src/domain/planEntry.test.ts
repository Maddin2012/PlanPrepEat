import { describe, expect, it } from 'vitest'
import { isRecipeEntry, planEntryData, toPlanEntry } from './types.ts'
import type { PlanEntry } from './types.ts'

/**
 * `toPlanEntry` steht zwischen den gespeicherten Plänen und der App. Liegt es
 * falsch, verschwinden eingeplante Tage beim Lesen — und zwar stumm, weil ein
 * nicht erkannter Eintrag einfach wegfällt. Deshalb steht hier vor allem der
 * **Altbestand** im Mittelpunkt: Pläne, die vor dem freien Eintrag entstanden.
 */

describe('toPlanEntry — Altbestand', () => {
  it('lässt einen alten Rezepteintrag unverändert durch', () => {
    expect(toPlanEntry({ recipeId: 'r1', servings: 4 })).toEqual({
      recipeId: 'r1',
      servings: 4,
    })
  })

  it('setzt eine fehlende Portionszahl auf 1, statt den Eintrag zu verlieren', () => {
    // Lieber ein Eintrag mit einer geratenen Portionszahl als ein leerer Tag.
    expect(toPlanEntry({ recipeId: 'r1' })).toEqual({ recipeId: 'r1', servings: 1 })
    expect(toPlanEntry({ recipeId: 'r1', servings: 0 })).toEqual({
      recipeId: 'r1',
      servings: 1,
    })
    expect(toPlanEntry({ recipeId: 'r1', servings: 'vier' })).toEqual({
      recipeId: 'r1',
      servings: 1,
    })
  })

  it('gibt dem Rezept den Vorrang, wenn beides dasteht', () => {
    // Sonst könnte ein alter Eintrag versehentlich als freier Text durchgehen.
    expect(toPlanEntry({ recipeId: 'r1', servings: 2, text: 'Quatsch' })).toEqual({
      recipeId: 'r1',
      servings: 2,
    })
  })
})

describe('toPlanEntry — freier Eintrag', () => {
  it('nimmt einen Text an', () => {
    expect(toPlanEntry({ text: 'Pizza bestellen' })).toEqual({
      text: 'Pizza bestellen',
    })
  })

  it('schneidet Leerraum ab', () => {
    expect(toPlanEntry({ text: '  Reste  ' })).toEqual({ text: 'Reste' })
  })

  it('weist einen leeren Text ab', () => {
    expect(toPlanEntry({ text: '   ' })).toBeNull()
    expect(toPlanEntry({ text: '' })).toBeNull()
  })
})

describe('toPlanEntry — Unrat', () => {
  it('gibt null zurück, statt etwas Halbes zu bauen', () => {
    expect(toPlanEntry(null)).toBeNull()
    expect(toPlanEntry(undefined)).toBeNull()
    expect(toPlanEntry('Rezept')).toBeNull()
    expect(toPlanEntry(42)).toBeNull()
    expect(toPlanEntry({})).toBeNull()
    expect(toPlanEntry({ recipeId: '' })).toBeNull()
    expect(toPlanEntry({ recipeId: 7, servings: 2 })).toBeNull()
  })
})

describe('isRecipeEntry', () => {
  it('trennt die beiden Formen', () => {
    expect(isRecipeEntry({ recipeId: 'r1', servings: 2 })).toBe(true)
    expect(isRecipeEntry({ text: 'Reste' })).toBe(false)
  })
})

describe('toPlanEntry — wer mitisst', () => {
  it('nimmt die Namen mit', () => {
    expect(toPlanEntry({ recipeId: 'r1', servings: 2, eaters: ['Martin'] })).toEqual({
      recipeId: 'r1',
      servings: 2,
      eaters: ['Martin'],
    })
  })

  it('hängt auch an einem freien Eintrag', () => {
    expect(toPlanEntry({ text: 'Pizza bestellen', eaters: ['Steffi'] })).toEqual({
      text: 'Pizza bestellen',
      eaters: ['Steffi'],
    })
  })

  it('lässt das Feld weg, wenn niemand angehakt ist', () => {
    // Nicht `eaters: []`: Ein leeres Feld an jedem Eintrag wäre Ballast in der
    // Ablage und würde beim Vergleichen zweier Einträge stören.
    expect(toPlanEntry({ recipeId: 'r1', servings: 2, eaters: [] })).toEqual({
      recipeId: 'r1',
      servings: 2,
    })
    expect(toPlanEntry({ recipeId: 'r1', servings: 2 })).toEqual({
      recipeId: 'r1',
      servings: 2,
    })
  })

  it('wirft Unbrauchbares aus der Namensliste', () => {
    expect(
      toPlanEntry({ recipeId: 'r1', servings: 2, eaters: ['Martin', 7, '', null] }),
    ).toEqual({ recipeId: 'r1', servings: 2, eaters: ['Martin'] })
  })

  it('verkraftet eine Namensliste, die gar keine ist', () => {
    expect(toPlanEntry({ recipeId: 'r1', servings: 2, eaters: 'Martin' })).toEqual({
      recipeId: 'r1',
      servings: 2,
    })
  })
})

describe('planEntryData — was in die Ablage geht', () => {
  it('schreibt niemals ein undefined', () => {
    // Firestore bricht das Schreiben bei `undefined` ab. Ein Eintrag ohne
    // Namen hätte damit den ganzen Platz mitgerissen.
    for (const entry of [
      { recipeId: 'r1', servings: 2 },
      { text: 'Reste' },
      { recipeId: 'r1', servings: 2, eaters: [] },
    ] as PlanEntry[]) {
      const data = planEntryData(entry)
      expect(Object.values(data).every((value) => value !== undefined)).toBe(true)
      expect('eaters' in data).toBe(false)
    }
  })

  it('nimmt die Namen mit, wenn welche dastehen', () => {
    expect(planEntryData({ recipeId: 'r1', servings: 2, eaters: ['Martin'] })).toEqual({
      recipeId: 'r1',
      servings: 2,
      eaters: ['Martin'],
    })
  })

  it('überlebt die Rundreise durch die Ablage', () => {
    const entry: PlanEntry = { text: 'Grillen', eaters: ['Martin', 'Steffi'] }
    expect(toPlanEntry(planEntryData(entry))).toEqual(entry)
  })
})
