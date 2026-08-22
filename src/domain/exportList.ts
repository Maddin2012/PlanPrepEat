import type { ShoppingItem } from './types.ts'
import { formatAmount } from './units.ts'
import { formatPlanRange } from './planWindow.ts'

export interface ExportOptions {
  /** Startdatum des Zeitraums, kommt als Überschrift in die Notiz. */
  startDate?: string
  /** Bereits Abgehaktes mitschicken? Standard: nein. */
  includeChecked?: boolean
}

/**
 * Formatiert die Einkaufsliste als reinen Text für Google Notizen.
 *
 * Jede Position beginnt mit „- ", weil Keep eine so aufgebaute Notiz über
 * „In Liste umwandeln" mit einem Tipp in eine Checkliste verwandelt. Eine
 * echte Keep-API, die die Notiz direkt anlegen könnte, gibt es für private
 * Google-Konten nicht — der Weg führt über den Teilen-Dialog von Android.
 */
export function formatShoppingListText(
  items: ShoppingItem[],
  options: ExportOptions = {},
): string {
  const visible = options.includeChecked
    ? items
    : items.filter((item) => !item.checked)

  const heading = options.startDate
    ? `Einkaufsliste ${formatPlanRange(options.startDate)}`
    : 'Einkaufsliste'

  if (visible.length === 0) {
    return `${heading}\n\n(nichts offen)`
  }

  return [heading, '', ...visible.map((item) => `- ${formatItemLine(item)}`)].join(
    '\n',
  )
}

/** „Zwiebeln, 500 g" bzw. nur „Salz", wenn keine Menge hinterlegt ist. */
export function formatItemLine(item: ShoppingItem): string {
  const amount = formatAmount(item.amount, item.unit)
  return amount ? `${item.name}, ${amount}` : item.name
}
