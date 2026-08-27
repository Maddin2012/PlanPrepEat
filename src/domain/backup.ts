import type { Recipe, RecipeItem } from './types.ts'
import { formatAmount } from './units.ts'

/**
 * Die Rezepte als lesbarer Text — die einzige Sicherung, die es gibt.
 *
 * Bewusst kein JSON: Die Datei ist zum Nachlesen und Abtippen da, nicht zum
 * Zurückspielen. Wer ein verlorenes Rezept sucht, öffnet sie auf dem Handy und
 * schreibt ab; eine JSON-Datei wäre dafür eine Zumutung.
 *
 * Der Aufbau bleibt trotzdem streng — feste Überschriften, eine Zutat je Zeile.
 * Falls wir später doch einen Einleser wollen, ist der Weg nicht verbaut.
 *
 * **Ohne Fotos.** Ein Vollbild wiegt bis zu 0,7 MB, ein Rezept als Text ein bis
 * zwei Kilobyte. Die Bilder machten die Datei unhandlich, und sie sind der
 * Teil, dessen Verlust am ehesten zu verschmerzen ist.
 */
export function formatRecipeBackup(
  recipes: Recipe[],
  meta: { household: string; now: Date },
): string {
  const kopf = [
    'PlanPrepEat — Sicherung der Rezepte',
    `Haushalt: ${meta.household}`,
    `Stand: ${formatStamp(meta.now)}`,
    `Rezepte: ${recipes.length}`,
  ]

  if (recipes.length === 0) {
    // Eine leere Datei ließe einen rätseln, ob der Knopf kaputt ist.
    return [...kopf, '', TRENNER_DICK, '', '(keine Rezepte)', ''].join('\n')
  }

  // Nach Namen, nicht nach Anlagedatum: So lassen sich zwei Sicherungen aus
  // verschiedenen Wochen nebeneinanderlegen und vergleichen.
  const sortiert = [...recipes].sort((a, b) =>
    a.name.localeCompare(b.name, 'de'),
  )

  return [
    ...kopf,
    '',
    TRENNER_DICK,
    '',
    sortiert.map(formatRecipe).join(`\n${TRENNER_DUENN}\n\n`),
  ].join('\n')
}

const TRENNER_DICK = '═'.repeat(40)
const TRENNER_DUENN = '─'.repeat(40)

/**
 * Ein Rezept als lesbarer Text.
 *
 * Öffentlich, weil zwei Wege ihn brauchen: die Sicherung aller Rezepte und das
 * Verschicken eines einzelnen. Die Form ist dieselbe — und `recipeText.ts`
 * liest sie wieder ein. Wer hier etwas ändert, muss dort nachziehen; die
 * Hin-und-Rückweg-Tests halten die beiden zusammen.
 */
export function formatRecipe(recipe: Recipe): string {
  const zeilen = [recipe.name, formatMeta(recipe), '']

  if (recipe.items.length > 0) {
    zeilen.push('Zutaten:', ...recipe.items.map(formatItem), '')
  }

  const schritte = splitSteps(recipe.steps)
  if (schritte.length > 0) {
    zeilen.push(
      'Zubereitung:',
      ...schritte.map((schritt, i) => `${i + 1}. ${schritt}`),
      '',
    )
  }

  return zeilen.join('\n')
}

/** „Portionen: 2 · Zeit: 25 Min" — die Zeit nur, wenn eine angegeben ist. */
function formatMeta(recipe: Recipe): string {
  const teile = [`Portionen: ${recipe.servings}`]
  // minutes: 0 heißt laut Typ „keine Angabe" — dann nichts behaupten.
  if (recipe.minutes > 0) teile.push(`Zeit: ${recipe.minutes} Min`)
  return teile.join(' · ')
}

/**
 * „Parmesan, 60 g (fein gerieben)".
 *
 * Die Menge kommt aus `formatAmount`, damit sie genauso dasteht wie in der App —
 * inklusive der Umrechnung von 1000 g auf 1 kg. Selbst formatieren hieße, dass
 * die beiden mit der Zeit auseinanderlaufen.
 */
function formatItem(item: RecipeItem): string {
  const menge = formatAmount(item.amount, item.unit)
  const kopf = menge ? `${item.name}, ${menge}` : item.name
  // Die Notiz steht im Rezept, gehört also in die Sicherung — auch wenn sie
  // auf der Einkaufsliste nichts zu suchen hat.
  return item.note ? `- ${kopf} (${item.note})` : `- ${kopf}`
}

/** Leerzeilen im Fließtext verwerfen, sonst entstehen leere Nummern. */
function splitSteps(steps: string): string[] {
  return steps
    .split('\n')
    .map((zeile) => zeile.trim())
    .filter(Boolean)
}

/** „25.08.2026, 14:30 Uhr" */
function formatStamp(now: Date): string {
  const datum = now.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const zeit = now.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${datum}, ${zeit} Uhr`
}

/** „PlanPrepEat-Rezepte-2026-08-25.txt" — mit Datum, damit sich mehrere
 *  Sicherungen nicht gegenseitig überschreiben. */
export function backupFilename(now: Date): string {
  const tag = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
  return `PlanPrepEat-Rezepte-${tag}.txt`
}
