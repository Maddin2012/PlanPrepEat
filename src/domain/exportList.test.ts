import { describe, expect, it } from 'vitest'
import { formatShoppingListText } from './exportList.ts'
import type { ShoppingItem } from './types.ts'

function item(partial: Partial<ShoppingItem> & { name: string }): ShoppingItem {
  return {
    key: partial.name,
    category: 'other',
    amount: null,
    unit: null,
    checked: false,
    edited: false,
    manual: false,
    sources: [],
    ...partial,
  }
}

const items: ShoppingItem[] = [
  item({ name: 'Zwiebeln', category: 'produce', amount: 500, unit: 'g' }),
  item({ name: 'Milch', category: 'dairy', amount: 1000, unit: 'ml' }),
  item({ name: 'Salz', category: 'pantry' }),
  item({
    name: 'Nudeln',
    category: 'pantry',
    amount: 500,
    unit: 'g',
    checked: true,
  }),
]

describe('formatShoppingListText', () => {
  it('gruppiert nach Abteilung und lässt Abgehaktes weg', () => {
    expect(formatShoppingListText(items, { startDate: '2026-08-26' })).toBe(
      [
        'Einkaufsliste Mi, 26.08. – So, 06.09.2026',
        '',
        'Obst & Gemüse',
        '- Zwiebeln, 500 g',
        '',
        'Kühlregal',
        '- Milch, 1 l',
        '',
        'Vorrat',
        '- Salz',
      ].join('\n'),
    )
  })

  it('nimmt Abgehaktes auf Wunsch mit', () => {
    const text = formatShoppingListText(items, { includeChecked: true })
    expect(text).toContain('- Nudeln, 500 g')
  })

  it('beginnt jede Position mit „- ", damit Keep sie in eine Liste umwandeln kann', () => {
    const lines = formatShoppingListText(items).split('\n')
    const positions = lines.filter((line) => line.startsWith('- '))
    expect(positions).toHaveLength(3)
  })

  it('sagt Bescheid, wenn nichts offen ist', () => {
    const text = formatShoppingListText([item({ name: 'X', checked: true })])
    expect(text).toContain('(nichts offen)')
  })
})
