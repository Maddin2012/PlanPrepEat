import { describe, expect, it } from 'vitest'
import { backupFilename, formatRecipeBackup } from './backup.ts'
import type { Recipe } from './types.ts'

/**
 * Die Sicherung ist das Einzige, was zwischen einem verlorenen Rezept und dem
 * Nichts steht. Sie wird im Ernstfall gelesen — Monate nachdem sie entstand,
 * von jemandem, der sie nicht mehr im Kopf hat. Fehlt darin etwas, merkt es
 * niemand, bis es zu spät ist.
 */

function rezept(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'r1',
    name: 'Spaghetti Carbonara',
    servings: 2,
    minutes: 25,
    steps: 'Wasser aufsetzen und salzen.\nSpeck auslassen.',
    items: [
      { ingredientId: 'i1', name: 'Spaghetti', amount: 250, unit: 'g' },
      { ingredientId: 'i2', name: 'Eier', amount: 3, unit: 'stk' },
    ],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

const META = { household: 'Zuhause', now: new Date(2026, 7, 25, 14, 30) }

describe('formatRecipeBackup', () => {
  it('nennt im Kopf Haushalt, Stand und Anzahl', () => {
    const text = formatRecipeBackup([rezept(), rezept({ id: 'r2', name: 'Chili' })], META)
    expect(text).toContain('Haushalt: Zuhause')
    expect(text).toContain('25.08.2026')
    expect(text).toContain('Rezepte: 2')
  })

  it('schreibt ein Rezept vollständig heraus', () => {
    const text = formatRecipeBackup([rezept()], META)
    expect(text).toContain('Spaghetti Carbonara')
    expect(text).toContain('Portionen: 2 · Zeit: 25 Min')
    expect(text).toContain('- Spaghetti, 250 g')
    expect(text).toContain('1. Wasser aufsetzen und salzen.')
    expect(text).toContain('2. Speck auslassen.')
  })

  it('hängt die Notiz einer Zutat in Klammern an', () => {
    const text = formatRecipeBackup(
      [
        rezept({
          items: [
            {
              ingredientId: 'i3',
              name: 'Parmesan',
              amount: 60,
              unit: 'g',
              note: 'fein gerieben',
            },
          ],
        }),
      ],
      META,
    )
    expect(text).toContain('- Parmesan, 60 g (fein gerieben)')
  })

  it('behauptet keine Zeit, wenn keine angegeben ist', () => {
    // minutes: 0 heißt laut Typ „keine Angabe" — nicht „null Minuten".
    const text = formatRecipeBackup([rezept({ minutes: 0 })], META)
    expect(text).toContain('Portionen: 2')
    expect(text).not.toContain('Zeit:')
  })

  it('erzeugt aus Leerzeilen keine leeren Schrittnummern', () => {
    const text = formatRecipeBackup(
      [rezept({ steps: 'Erster Schritt.\n\n\nZweiter Schritt.\n' })],
      META,
    )
    expect(text).toContain('1. Erster Schritt.')
    expect(text).toContain('2. Zweiter Schritt.')
    expect(text).not.toContain('3.')
  })

  it('sortiert nach Namen, egal wie sie hereinkommen', () => {
    // Damit sich zwei Sicherungen aus verschiedenen Wochen vergleichen lassen.
    const text = formatRecipeBackup(
      [
        rezept({ id: 'a', name: 'Zwiebelkuchen' }),
        rezept({ id: 'b', name: 'Apfelstrudel' }),
        rezept({ id: 'c', name: 'Möhrensuppe' }),
      ],
      META,
    )
    const reihenfolge = ['Apfelstrudel', 'Möhrensuppe', 'Zwiebelkuchen'].map((n) =>
      text.indexOf(n),
    )
    expect(reihenfolge).toEqual([...reihenfolge].sort((a, b) => a - b))
  })

  it('stellt Mengen so dar wie die App selbst', () => {
    // Über formatAmount, nicht selbst gerechnet: 1000 g sind 1 kg.
    const text = formatRecipeBackup(
      [
        rezept({
          items: [
            { ingredientId: 'i4', name: 'Mehl', amount: 1000, unit: 'g' },
          ],
        }),
      ],
      META,
    )
    expect(text).toContain('- Mehl, 1 kg')
  })

  it('sagt bei leerem Rezeptbuch, dass nichts da ist', () => {
    // Eine leere Datei ließe einen rätseln, ob der Knopf kaputt ist.
    const text = formatRecipeBackup([], META)
    expect(text).toContain('Rezepte: 0')
    expect(text).toContain('(keine Rezepte)')
  })

  it('kommt ohne Zutaten und ohne Schritte zurecht', () => {
    const text = formatRecipeBackup([rezept({ items: [], steps: '' })], META)
    expect(text).toContain('Spaghetti Carbonara')
    expect(text).not.toContain('Zutaten:')
    expect(text).not.toContain('Zubereitung:')
  })
})

describe('backupFilename', () => {
  it('trägt das Datum, damit sich Sicherungen nicht überschreiben', () => {
    expect(backupFilename(new Date(2026, 7, 25))).toBe(
      'PlanPrepEat-Rezepte-2026-08-25.txt',
    )
    // Einstellige Monate und Tage mit führender Null, sonst sortiert der
    // Dateimanager sie falsch.
    expect(backupFilename(new Date(2026, 0, 3))).toBe(
      'PlanPrepEat-Rezepte-2026-01-03.txt',
    )
  })
})
