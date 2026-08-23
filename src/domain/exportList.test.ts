import { describe, expect, it } from 'vitest'
import { formatShoppingListText } from './exportList.ts'
import type { ShoppingItem } from './types.ts'

function item(partial: Partial<ShoppingItem> & { name: string }): ShoppingItem {
  return {
    key: partial.name,
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
  item({ name: 'Milch', amount: 1000, unit: 'ml' }),
  item({ name: 'Nudeln', amount: 500, unit: 'g', checked: true }),
  item({ name: 'Salz' }),
  item({ name: 'Zwiebeln', amount: 500, unit: 'g' }),
]

describe('formatShoppingListText', () => {
  it('schreibt eine durchgehende Liste und lässt Abgehaktes weg', () => {
    expect(formatShoppingListText(items, { from: '2026-08-18', to: '2026-08-29' })).toBe(
      [
        'Einkaufsliste 18.08. – 29.08.2026',
        '',
        '- Milch, 1 l',
        '- Salz',
        '- Zwiebeln, 500 g',
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
