import type { UnitCode, CategoryCode } from './types.ts'

export const UNIT_LABELS: Record<UnitCode, string> = {
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'l',
  stk: 'Stück',
  el: 'EL',
  tl: 'TL',
  prise: 'Prise',
  bund: 'Bund',
  pkg: 'Packung',
}

/** Reihenfolge im Einheiten-Auswahlfeld — die häufigsten zuerst. */
export const UNIT_ORDER: UnitCode[] = [
  'g',
  'kg',
  'ml',
  'l',
  'stk',
  'el',
  'tl',
  'prise',
  'bund',
  'pkg',
]

/**
 * Auf welche Basiseinheit eine Einheit zurückgeführt wird und mit welchem
 * Faktor. Nur Masse und Volumen werden umgerechnet: EL und TL bleiben getrennt,
 * weil ihr Gewicht von der Zutat abhängt und eine Umrechnung nur falsche
 * Genauigkeit vortäuschen würde.
 */
const BASE: Record<UnitCode, { unit: UnitCode; factor: number }> = {
  g: { unit: 'g', factor: 1 },
  kg: { unit: 'g', factor: 1000 },
  ml: { unit: 'ml', factor: 1 },
  l: { unit: 'ml', factor: 1000 },
  stk: { unit: 'stk', factor: 1 },
  el: { unit: 'el', factor: 1 },
  tl: { unit: 'tl', factor: 1 },
  prise: { unit: 'prise', factor: 1 },
  bund: { unit: 'bund', factor: 1 },
  pkg: { unit: 'pkg', factor: 1 },
}

/** Einheiten, bei denen halbe Stücke beim Einkaufen keinen Sinn ergeben. */
const WHOLE_UNITS: ReadonlySet<UnitCode> = new Set<UnitCode>([
  'stk',
  'prise',
  'bund',
  'pkg',
])

export interface NormalizedAmount {
  amount: number
  unit: UnitCode
}

/** Rechnet eine Menge auf ihre Basiseinheit um (kg → g, l → ml). */
export function normalize(amount: number, unit: UnitCode): NormalizedAmount {
  const base = BASE[unit] ?? BASE.stk
  return { amount: amount * base.factor, unit: base.unit }
}

/**
 * Wählt für die Anzeige die angenehmste Einheit: aus 1500 g wird 1,5 kg,
 * aus 2000 ml werden 2 l. Unterhalb von 1000 bleibt alles wie es ist.
 */
export function prettify(amount: number, unit: UnitCode): NormalizedAmount {
  if (unit === 'g' && Math.abs(amount) >= 1000) {
    return { amount: amount / 1000, unit: 'kg' }
  }
  if (unit === 'ml' && Math.abs(amount) >= 1000) {
    return { amount: amount / 1000, unit: 'l' }
  }
  return { amount, unit }
}

/**
 * Rundet eine Menge so, wie man sie tatsächlich einkauft: Stückzahlen immer
 * auf ganze Einheiten aufgerundet (1,5 Zwiebeln heißt: zwei kaufen), Gramm und
 * Milliliter auf ganze Zahlen, kleine Mengen mit einer Nachkommastelle.
 */
export function roundForShopping(amount: number, unit: UnitCode): number {
  if (WHOLE_UNITS.has(unit)) return Math.ceil(roundTo(amount, 2))
  if (unit === 'g' || unit === 'ml') {
    return amount >= 10 ? Math.round(amount) : roundTo(amount, 1)
  }
  return roundTo(amount, 2)
}

/** Rundet auf `digits` Nachkommastellen und vermeidet 0.30000000000000004. */
export function roundTo(value: number, digits: number): number {
  const f = 10 ** digits
  return Math.round((value + Number.EPSILON) * f) / f
}

/** Zahl mit deutschem Dezimalkomma und ohne überflüssige Nullen. */
export function formatNumber(value: number): string {
  const rounded = roundTo(value, 2)
  return rounded.toLocaleString('de-DE', { maximumFractionDigits: 2 })
}

/**
 * Menge samt Einheit als lesbarer Text, z.B. „1,5 kg" oder „3 Stück".
 * Ohne Menge (manueller Posten) kommt nur die Einheit bzw. ein leerer String.
 */
export function formatAmount(
  amount: number | null,
  unit: UnitCode | null,
): string {
  if (amount === null) return unit ? UNIT_LABELS[unit] : ''
  if (!unit) return formatNumber(amount)
  const pretty = prettify(amount, unit)
  return `${formatNumber(pretty.amount)} ${UNIT_LABELS[pretty.unit]}`
}

export const CATEGORY_LABELS: Record<CategoryCode, string> = {
  produce: 'Obst & Gemüse',
  bakery: 'Backwaren',
  meat: 'Fleisch & Fisch',
  dairy: 'Kühlregal',
  frozen: 'Tiefkühl',
  pantry: 'Vorrat',
  drinks: 'Getränke',
  household: 'Haushalt',
  other: 'Sonstiges',
}

/** Reihenfolge der Abteilungen auf der Einkaufsliste. */
export const CATEGORY_ORDER: CategoryCode[] = [
  'produce',
  'bakery',
  'meat',
  'dairy',
  'frozen',
  'pantry',
  'drinks',
  'household',
  'other',
]

export function categoryRank(category: CategoryCode): number {
  const index = CATEGORY_ORDER.indexOf(category)
  return index === -1 ? CATEGORY_ORDER.length : index
}
