import { describe, expect, it } from 'vitest'
import { isRecipeEntry, toPlanEntry } from './types.ts'

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
