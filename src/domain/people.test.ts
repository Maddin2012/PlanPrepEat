import { describe, expect, it } from 'vitest'
import {
  MAX_NAME,
  MAX_PEOPLE,
  addPerson,
  cleanPersonName,
  eatersLabel,
  normalizeEaters,
  removePerson,
  toPeople,
  toggleEater,
} from './people.ts'

describe('cleanPersonName', () => {
  it('zieht Leerraum zusammen', () => {
    expect(cleanPersonName('  Martin   ')).toBe('Martin')
    expect(cleanPersonName('Anna\tLena')).toBe('Anna Lena')
  })

  it('kürzt zu lange Namen', () => {
    expect(cleanPersonName('M'.repeat(50))).toHaveLength(MAX_NAME)
  })
})

describe('addPerson', () => {
  it('nimmt einen Namen auf', () => {
    expect(addPerson([], 'Martin')).toEqual(['Martin'])
  })

  it('lässt Leeres weg', () => {
    expect(addPerson([], '   ')).toEqual([])
  })

  it('nimmt denselben Namen nicht zweimal — auch anders geschrieben', () => {
    // Sonst hingen an einem Eintrag zwei Marken für denselben Menschen.
    expect(addPerson(['Martin'], 'martin')).toEqual(['Martin'])
    expect(addPerson(['Martin'], ' MARTIN ')).toEqual(['Martin'])
  })

  it('hört bei der Höchstzahl auf', () => {
    const voll = Array.from({ length: MAX_PEOPLE }, (_, i) => `P${i}`)
    expect(addPerson(voll, 'Noch einer')).toEqual(voll)
  })
})

describe('removePerson', () => {
  it('nimmt einen Namen heraus', () => {
    expect(removePerson(['Martin', 'Steffi'], 'Martin')).toEqual(['Steffi'])
  })

  it('trifft auch bei anderer Schreibweise', () => {
    expect(removePerson(['Martin'], 'martin')).toEqual([])
  })
})

describe('toggleEater', () => {
  it('hakt an und wieder ab', () => {
    expect(toggleEater([], 'Martin')).toEqual(['Martin'])
    expect(toggleEater(['Martin'], 'Martin')).toEqual([])
  })

  it('lässt die anderen stehen', () => {
    expect(toggleEater(['Martin', 'Steffi'], 'Martin')).toEqual(['Steffi'])
  })
})

describe('normalizeEaters', () => {
  const haushalt = ['Martin', 'Steffi']

  it('macht aus „alle angehakt" die leere Auswahl', () => {
    expect(normalizeEaters(['Martin', 'Steffi'], haushalt)).toEqual([])
  })

  it('lässt eine echte Auswahl stehen', () => {
    expect(normalizeEaters(['Martin'], haushalt)).toEqual(['Martin'])
  })

  it('rührt nichts an, wenn es nur einen Namen im Haushalt gibt', () => {
    // Bei einer Person wäre jede Auswahl „alle" — dann könnte man den einen
    // Namen nie anhaken.
    expect(normalizeEaters(['Martin'], ['Martin'])).toEqual(['Martin'])
  })
})

describe('eatersLabel', () => {
  const haushalt = ['Martin', 'Steffi']

  it('zeigt nichts, wenn niemand angehakt ist', () => {
    // Der Normalfall: Es essen alle mit, eine Marke wäre nur Lärm.
    expect(eatersLabel([], haushalt)).toBeNull()
    expect(eatersLabel(undefined, haushalt)).toBeNull()
  })

  it('zeigt den einen Namen', () => {
    expect(eatersLabel(['Martin'], haushalt)).toBe('Martin')
  })

  it('macht aus „alle angehakt" ein Wort', () => {
    expect(eatersLabel(['Martin', 'Steffi'], haushalt)).toBe('alle')
  })

  it('sagt nicht „alle", wenn es nur einen Namen im Haushalt gibt', () => {
    // Bei einer einzigen Person wäre „alle" eine seltsame Auskunft.
    expect(eatersLabel(['Martin'], ['Martin'])).toBe('Martin')
  })

  it('zeigt auch einen Namen, den es im Haushalt nicht mehr gibt', () => {
    // Wer aus der Liste gestrichen wurde, steht am alten Eintrag weiter — der
    // Plan von letzter Woche soll nicht rückwirkend anders lauten.
    expect(eatersLabel(['Oma'], haushalt)).toBe('Oma')
  })
})

describe('toPeople', () => {
  it('nimmt eine gewöhnliche Liste an', () => {
    expect(toPeople(['Martin', 'Steffi'])).toEqual(['Martin', 'Steffi'])
  })

  it('wirft Unbrauchbares weg', () => {
    expect(toPeople(['Martin', 42, null, '', '  ', 'Martin'])).toEqual(['Martin'])
  })

  it('macht aus allem anderen eine leere Liste', () => {
    for (const unsinn of [null, undefined, 'Martin', {}, 7]) {
      expect(toPeople(unsinn)).toEqual([])
    }
  })
})
