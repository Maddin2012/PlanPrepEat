import type { UnitCode } from './types.ts'
import { UNIT_LABELS } from './units.ts'

/**
 * Ein Rezept aus Text zurücklesen — der Rückweg zu `formatRecipe` in
 * `backup.ts`.
 *
 * Damit lässt sich ein Rezept über jeden Messenger verschicken: Der Empfänger
 * kann es lesen, auch ohne die App, und wer sie hat, fügt den Text ein und hat
 * das Rezept. Kein Konto, keine Ablage außerhalb der Haushalte.
 *
 * **Was hier hereinkommt, hat unterwegs alles Mögliche erlebt** — Zeilenumbrüche
 * eines Messengers, ein Zitatzeichen davor, ein abgeschnittenes Ende. Deshalb
 * wird großzügig gelesen und im Zweifel lieber etwas in den Namen gesteckt, als
 * eine Zeile wegzuwerfen. Was gar nicht geht, sagt der Einleser beim Namen.
 */

export interface ParsedItem {
  name: string
  /** 0 heißt „nach Gefühl", wie im Formular auch. */
  amount: number
  unit: UnitCode
  note?: string
}

export interface ParsedRecipe {
  name: string
  servings: number
  minutes: number
  /** Schritte als Fließtext mit Zeilenumbrüchen — das Speicherformat. */
  steps: string
  items: ParsedItem[]
}

export class RecipeTextError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RecipeTextError'
  }
}

/** „Stück" → `stk`, und die Kurzformen gleich mit. */
const UNITS_BY_LABEL = new Map<string, UnitCode>(
  Object.entries(UNIT_LABELS).map(([code, label]) => [
    label.toLocaleLowerCase('de'),
    code as UnitCode,
  ]),
)

/**
 * Liest ein Rezept aus Text.
 *
 * Wirft `RecipeTextError`, wenn nicht einmal ein Name zu finden ist — dann ist
 * es kein Rezept, und ein leerer Eintrag wäre schlimmer als eine Meldung.
 */
export function parseRecipeText(text: string): ParsedRecipe {
  const zeilen = text
    .split(/\r?\n/)
    // Zitatzeichen, wie Messenger und Mailprogramme sie voranstellen.
    .map((zeile) => zeile.replace(/^\s*[>|]\s?/, '').trimEnd())

  const name = findName(zeilen)
  if (!name) {
    throw new RecipeTextError(
      'In diesem Text steht kein Rezept — es fehlt schon der Name.',
    )
  }

  const meta = findMeta(zeilen)
  return {
    name,
    servings: meta.servings,
    minutes: meta.minutes,
    items: readSection(zeilen, 'Zutaten:').map(readItem).filter(Boolean) as ParsedItem[],
    steps: readSection(zeilen, 'Zubereitung:').map(stripNumber).join('\n'),
  }
}

/**
 * Der Name ist die erste Zeile mit Inhalt, die keine Überschrift und keine
 * Trennlinie ist. Bei einem geteilten Rezept steht er oben; bei einem aus der
 * Sicherung herausgeschnittenen Stück auch.
 */
function findName(zeilen: string[]): string {
  for (const zeile of zeilen) {
    const wert = zeile.trim()
    if (!wert || isRule(wert)) continue
    if (/^(Zutaten|Zubereitung):/.test(wert)) continue
    if (/^(Portionen|Stand|Haushalt|Rezepte):/.test(wert)) continue
    if (wert.startsWith('PlanPrepEat')) continue
    return wert
  }
  return ''
}

/** „Portionen: 2 · Zeit: 25 Min" */
function findMeta(zeilen: string[]): { servings: number; minutes: number } {
  const zeile = zeilen.find((z) => /Portionen:\s*\d/.test(z)) ?? ''
  const portionen = /Portionen:\s*(\d+)/.exec(zeile)
  const zeit = /Zeit:\s*(\d+)/.exec(zeile)
  return {
    servings: portionen ? Math.max(1, Number(portionen[1])) : 1,
    minutes: zeit ? Math.max(0, Number(zeit[1])) : 0,
  }
}

/**
 * Die Zeilen unter einer Überschrift, bis zur nächsten Überschrift, Trennlinie
 * oder zum Ende.
 */
function readSection(zeilen: string[], ueberschrift: string): string[] {
  const start = zeilen.findIndex((z) => z.trim() === ueberschrift)
  if (start === -1) return []

  const result: string[] = []
  for (const zeile of zeilen.slice(start + 1)) {
    const wert = zeile.trim()
    if (isRule(wert)) break
    if (/^(Zutaten|Zubereitung):$/.test(wert)) break
    if (wert) result.push(wert)
  }
  return result
}

/** Die Trennlinien aus dem Sicherungsformat. */
function isRule(zeile: string): boolean {
  return /^[═─]{3,}$/.test(zeile)
}

/** „1. Zwiebeln würfeln." → „Zwiebeln würfeln." */
function stripNumber(zeile: string): string {
  return zeile.replace(/^\s*\d+[.)]\s*/, '').trim()
}

/**
 * „- Parmesan, 60 g (fein gerieben)" auseinandernehmen.
 *
 * Getrennt wird am **letzten** Komma, und nur dann, wenn dahinter wirklich eine
 * Menge steht. „Tomaten, geschält" bleibt dadurch ein Name und wird nicht zu
 * einer Zutat „Tomaten" mit der Menge „geschält".
 */
function readItem(zeile: string): ParsedItem | null {
  let rest = zeile.replace(/^\s*[-•*]\s*/, '').trim()
  if (!rest) return null

  let note: string | undefined
  const klammer = /\s*\(([^()]*)\)\s*$/.exec(rest)
  if (klammer) {
    note = klammer[1].trim() || undefined
    rest = rest.slice(0, klammer.index).trim()
  }

  // Von **links** durch die Kommas, und das erste nehmen, hinter dem wirklich
  // nur noch eine Menge steht. Nicht das letzte: Bei „Sahne, 1,5 l" wäre das
  // das Dezimalkomma, und heraus käme eine Zutat „Sahne, 1" mit 5 Litern.
  // Von links löst gleichzeitig den anderen Fall — „Tomaten, geschält, 400 g"
  // behält seinen zweiteiligen Namen.
  for (let komma = rest.indexOf(','); komma > 0; komma = rest.indexOf(',', komma + 1)) {
    const menge = readAmount(rest.slice(komma + 1))
    if (!menge) continue
    const name = rest.slice(0, komma).trim()
    if (name) return { name, ...menge, note }
  }

  // Ohne erkennbare Menge: alles ist der Name, „nach Gefühl".
  return rest ? { name: rest, amount: 0, unit: 'g', note } : null
}

/** „60 g", „1,5 kg", „3 Stück" — oder nichts. */
function readAmount(text: string): { amount: number; unit: UnitCode } | null {
  const treffer = /^\s*(\d+(?:[.,]\d+)?)\s*(\S+)\s*$/.exec(text)
  if (!treffer) return null

  const unit = UNITS_BY_LABEL.get(treffer[2].toLocaleLowerCase('de'))
  if (!unit) return null

  const amount = Number.parseFloat(treffer[1].replace(',', '.'))
  return Number.isFinite(amount) && amount >= 0 ? { amount, unit } : null
}
