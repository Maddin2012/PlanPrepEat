import { describe, expect, it } from 'vitest'
import { formatRecipe } from './backup.ts'
import { RecipeTextError, parseRecipeText } from './recipeText.ts'
import type { Recipe, RecipeItem } from './types.ts'

/**
 * Hin- und Rückweg müssen zusammenpassen: `formatRecipe` schreibt, dieser
 * Einleser liest. Läuft eines von beiden weg, kommt bei der anderen Person ein
 * halbes Rezept an — und niemand merkt es, weil beide Seiten für sich
 * funktionieren.
 *
 * Deshalb steht hier vor allem die **Rundreise**: Rezept → Text → Rezept, und
 * das Ergebnis noch einmal geschrieben muss denselben Text ergeben. Über den
 * Text zu vergleichen statt über die Felder ist Absicht — die Mengen werden
 * beim Schreiben umgerechnet (1000 g werden 1 kg), und das ist kein Verlust,
 * sondern dieselbe Menge.
 */

function recipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'r1',
    name: 'Spaghetti Carbonara',
    servings: 2,
    minutes: 25,
    steps: 'Wasser aufsetzen.\nSpeck auslassen.',
    items: [
      { ingredientId: 'i1', name: 'Spaghetti', amount: 250, unit: 'g' },
      { ingredientId: 'i2', name: 'Eier', amount: 3, unit: 'stk' },
    ],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

/** Aus dem Gelesenen wieder ein Rezept bauen, um es erneut zu schreiben. */
function wieder(gelesen: ReturnType<typeof parseRecipeText>): Recipe {
  return recipe({
    name: gelesen.name,
    servings: gelesen.servings,
    minutes: gelesen.minutes,
    steps: gelesen.steps,
    items: gelesen.items.map(
      (item, i): RecipeItem => ({
        ingredientId: `x${i}`,
        name: item.name,
        amount: item.amount,
        unit: item.unit,
        note: item.note,
      }),
    ),
  })
}

/** Die eigentliche Probe: geschrieben, gelesen, wieder geschrieben. */
function rundreise(original: Recipe): void {
  const text = formatRecipe(original)
  expect(formatRecipe(wieder(parseRecipeText(text)))).toBe(text)
}

describe('Rundreise', () => {
  it('übersteht ein gewöhnliches Rezept', () => {
    rundreise(recipe())
  })

  it('übersteht Umlaute und Notizen', () => {
    rundreise(
      recipe({
        name: 'Käsespätzle mit Röstzwiebeln',
        items: [
          {
            ingredientId: 'i1',
            name: 'Bergkäse',
            amount: 200,
            unit: 'g',
            note: 'frisch gerieben',
          },
        ],
        steps: 'Spätzle kochen.\nKäse darüber.',
      }),
    )
  })

  it('übersteht Brüche und große Mengen', () => {
    rundreise(
      recipe({
        items: [
          { ingredientId: 'i1', name: 'Sahne', amount: 1.5, unit: 'l' },
          { ingredientId: 'i2', name: 'Mehl', amount: 1000, unit: 'g' },
          { ingredientId: 'i3', name: 'Salz', amount: 0, unit: 'g' },
        ],
      }),
    )
  })

  it('übersteht ein Rezept ohne Zutaten und ohne Schritte', () => {
    rundreise(recipe({ items: [], steps: '' }))
  })

  it('übersteht eine fehlende Zeitangabe', () => {
    rundreise(recipe({ minutes: 0 }))
  })

  it('übersteht einen Namen mit Komma', () => {
    // Der Fall, an dem ein naives Trennen am Komma scheitert.
    rundreise(
      recipe({
        items: [
          { ingredientId: 'i1', name: 'Tomaten, geschält', amount: 400, unit: 'g' },
        ],
      }),
    )
  })

  it('verwechselt das Dezimalkomma nicht mit dem Trenner', () => {
    // „Sahne, 1,5 l" hat zwei Kommas. Beim letzten getrennt käme eine Zutat
    // „Sahne, 1" mit fünf Litern heraus — genau daran ist der erste Anlauf
    // gescheitert.
    const gelesen = parseRecipeText('Test\nZutaten:\n- Sahne, 1,5 l\n')
    expect(gelesen.items).toEqual([
      { name: 'Sahne', amount: 1.5, unit: 'l', note: undefined },
    ])
  })

  it('behält einen zweiteiligen Namen vor der Menge', () => {
    const gelesen = parseRecipeText('Test\nZutaten:\n- Tomaten, geschält, 400 g\n')
    expect(gelesen.items).toEqual([
      { name: 'Tomaten, geschält', amount: 400, unit: 'g', note: undefined },
    ])
  })
})

describe('parseRecipeText — einzelne Felder', () => {
  it('liest Name, Portionen und Zeit', () => {
    const gelesen = parseRecipeText(formatRecipe(recipe()))
    expect(gelesen.name).toBe('Spaghetti Carbonara')
    expect(gelesen.servings).toBe(2)
    expect(gelesen.minutes).toBe(25)
  })

  it('liest Zutaten mit Menge und Einheit', () => {
    const gelesen = parseRecipeText(formatRecipe(recipe()))
    expect(gelesen.items).toEqual([
      { name: 'Spaghetti', amount: 250, unit: 'g', note: undefined },
      { name: 'Eier', amount: 3, unit: 'stk', note: undefined },
    ])
  })

  it('macht aus einer Zutat ohne Menge „nach Gefühl"', () => {
    const gelesen = parseRecipeText('Suppe\nZutaten:\n- Salz\n')
    expect(gelesen.items).toEqual([
      { name: 'Salz', amount: 0, unit: 'g', note: undefined },
    ])
  })

  it('nimmt die Nummern von den Schritten wieder ab', () => {
    const gelesen = parseRecipeText(formatRecipe(recipe()))
    expect(gelesen.steps).toBe('Wasser aufsetzen.\nSpeck auslassen.')
  })
})

describe('parseRecipeText — was unterwegs passiert', () => {
  it('verkraftet Zitatzeichen aus einem Messenger', () => {
    const text = formatRecipe(recipe())
      .split('\n')
      .map((zeile) => `> ${zeile}`)
      .join('\n')
    expect(parseRecipeText(text).name).toBe('Spaghetti Carbonara')
  })

  it('verkraftet Zeilen mit Leerraum am Ende', () => {
    const text = formatRecipe(recipe())
      .split('\n')
      .map((zeile) => `${zeile}   `)
      .join('\r\n')
    expect(parseRecipeText(text).items).toHaveLength(2)
  })

  it('liest ein Rezept auch mitten aus einer Sicherung heraus', () => {
    // Wer aus der Sicherungsdatei ein Rezept herauskopiert, nimmt den Kopf
    // gern mit. Der darf nicht als Rezeptname durchgehen.
    const text = [
      'PlanPrepEat — Sicherung der Rezepte',
      'Haushalt: Zuhause',
      'Stand: 26.08.2026, 07:00 Uhr',
      'Rezepte: 1',
      '',
      '═'.repeat(40),
      '',
      formatRecipe(recipe()),
    ].join('\n')
    expect(parseRecipeText(text).name).toBe('Spaghetti Carbonara')
  })

  it('sagt Bescheid, wenn gar kein Rezept dasteht', () => {
    // Lieber eine Meldung als ein leerer Eintrag im Rezeptbuch.
    for (const unsinn of ['', '   ', '\n\n', '═'.repeat(40)]) {
      expect(() => parseRecipeText(unsinn)).toThrow(RecipeTextError)
    }
  })

  it('nimmt auch einen von Hand getippten Text an', () => {
    // Nicht jeder wird das Format einhalten. Wer nur den Namen schickt, soll
    // wenigstens den bekommen.
    const gelesen = parseRecipeText('Omas Kartoffelsalat')
    expect(gelesen.name).toBe('Omas Kartoffelsalat')
    expect(gelesen.servings).toBe(1)
    expect(gelesen.items).toEqual([])
  })
})
