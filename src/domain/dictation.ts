import type { UnitCode } from './types.ts'

/**
 * Gesprochenes in Formularfelder zerlegen.
 *
 * Hier steckt keine KI, sondern eine Handvoll Regeln: Zahlwort, Einheitenwort,
 * Rest ist der Name. Das deckt die Art ab, wie man ein Rezept vorliest —
 * „fünfhundert Gramm Mehl", „drei Eier", „eine Prise Salz".
 *
 * **Wichtiger als jede Trefferquote ist, wie es danebengeht:** Was nicht
 * erkannt wird, landet vollständig im Namensfeld. Dort steht es sichtbar da und
 * ist mit zwei Handgriffen richtiggestellt — nichts geht verloren, nichts wird
 * still verschluckt.
 */

/** Ausgeschriebene Zahlen, wie man sie beim Vorlesen benutzt. */
const NUMBER_WORDS: Record<string, number> = {
  ein: 1,
  eine: 1,
  einen: 1,
  einem: 1,
  eins: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
  elf: 11,
  zwölf: 12,
  anderthalb: 1.5,
  eineinhalb: 1.5,
  zweieinhalb: 2.5,
}

/** „ein halbes Kilo" — das Wort danach zählt als Hälfte. */
const HALF_WORDS = new Set(['halb', 'halbe', 'halber', 'halbes', 'halben'])

/** Was zwischen Einheit und Zutat gesagt wird, ohne dazuzugehören. */
const FILLER_WORDS = new Set(['von', 'vom', 'der', 'die', 'das', 'dem', 'den'])

/**
 * Einheitenwörter, ausgeschrieben wie gesprochen. Die Spracherkennung liefert
 * mal „Gramm", mal „g" — beides muss hier ankommen.
 */
const UNIT_WORDS: Record<string, UnitCode> = {
  g: 'g',
  gramm: 'g',
  kg: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  kilogramm: 'kg',
  ml: 'ml',
  milliliter: 'ml',
  l: 'l',
  liter: 'l',
  stk: 'stk',
  stück: 'stk',
  stücke: 'stk',
  el: 'el',
  esslöffel: 'el',
  essloeffel: 'el',
  tl: 'tl',
  teelöffel: 'tl',
  teeloeffel: 'tl',
  prise: 'prise',
  prisen: 'prise',
  bund: 'bund',
  packung: 'pkg',
  packungen: 'pkg',
  päckchen: 'pkg',
  paket: 'pkg',
}

export interface SpokenIngredient {
  /** Wie im Formular: Text, damit „1,5" unverändert stehen bleibt. */
  amount: string
  unit: UnitCode
  name: string
}

/** Ziffern wie „500", „1,5" oder „1.5". */
function digits(token: string): number | null {
  if (!/^\d+([.,]\d+)?$/.test(token)) return null
  const value = Number.parseFloat(token.replace(',', '.'))
  return Number.isFinite(value) ? value : null
}

/** Satzzeichen und Umschließendes weg, für den Vergleich mit den Wortlisten. */
function bare(token: string): string {
  return token.replace(/[.,;:!?]+$/u, '').toLocaleLowerCase('de')
}

function formatAmount(value: number): string {
  return String(value).replace('.', ',')
}

/**
 * Zerlegt einen gesprochenen Abschnitt in eine Zutatenzeile.
 *
 * Ohne erkennbare Menge bleibt das Mengenfeld leer — in diesem Formular heißt
 * das „nach Gefühl", und genau so ist „Salz" auch gemeint. Steht eine Zahl da,
 * aber keine Einheit („drei Eier"), ist Stück gemeint.
 */
export function parseSpokenIngredient(text: string): SpokenIngredient {
  const tokens = text.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return { amount: '', unit: 'g', name: '' }

  let position = 0
  let amount: number | null = null

  const first = bare(tokens[0])
  const asDigits = digits(first)

  if (asDigits !== null) {
    amount = asDigits
    position = 1
  } else if (first in NUMBER_WORDS) {
    amount = NUMBER_WORDS[first]
    position = 1
    // „ein halbes Kilo" — die Eins davor ist nur Grammatik.
    if (amount === 1 && tokens[1] && HALF_WORDS.has(bare(tokens[1]))) {
      amount = 0.5
      position = 2
    }
  } else if (HALF_WORDS.has(first)) {
    amount = 0.5
    position = 1
  }

  let unit: UnitCode | null = null
  if (tokens[position] && bare(tokens[position]) in UNIT_WORDS) {
    unit = UNIT_WORDS[bare(tokens[position])]
    position += 1
    // „500 Gramm von dem Mehl" — Füllwörter gehören nicht in den Namen.
    // Höchstens zwei, damit nicht versehentlich der Name selbst wegfällt.
    for (let skipped = 0; skipped < 2; skipped++) {
      if (!tokens[position] || !FILLER_WORDS.has(bare(tokens[position]))) break
      position += 1
    }
  }

  // Vorn war nichts? Dann das Ende absuchen — „Tomaten 200 Gramm" ist genauso
  // gemeint wie „200 Gramm Tomaten", und beim Diktieren rutscht einem mal das
  // eine, mal das andere heraus.
  //
  // Nur wenn vorn **gar nichts** stand: Sonst risse „500 Gramm Mehl 2" die
  // vordere Angabe wieder ein.
  if (amount === null && unit === null) {
    const hinten = readTrailing(tokens)
    if (hinten) {
      const davor = tokens.slice(0, hinten.from).join(' ').trim()
      // Ohne Namen davor war es doch nur eine Menge — dann greift unten die
      // gewohnte Notlösung und der ganze Satz wird zum Namen.
      if (davor) {
        return {
          amount: formatAmount(hinten.amount),
          unit: hinten.unit ?? 'stk',
          name: capitalize(davor),
        }
      }
    }
  }

  const name = tokens.slice(position).join(' ').trim()

  // Eine Einheit ohne alles andere ist kein Rezept, sondern verhört: dann
  // lieber den ganzen Satz als Namen stehen lassen.
  if (!name) return { amount: '', unit: 'g', name: text.trim() }

  return {
    amount: amount === null ? '' : formatAmount(amount),
    unit: unit ?? (amount === null ? 'g' : 'stk'),
    name: capitalize(name),
  }
}

/**
 * Menge und Einheit am **Ende** lesen: „… 200 Gramm", „… 3", „… ein halbes Kilo".
 *
 * `from` sagt, ab welchem Wort die Angabe beginnt — alles davor ist der Name.
 * `null` heißt: Am Ende steht keine Menge, hier ist nichts zu holen.
 */
function readTrailing(
  tokens: string[],
): { amount: number; unit: UnitCode | null; from: number } | null {
  let ende = tokens.length
  let unit: UnitCode | null = null

  if (bare(tokens[ende - 1]) in UNIT_WORDS) {
    unit = UNIT_WORDS[bare(tokens[ende - 1])]
    ende -= 1
  }
  if (ende === 0) return null

  const zahl = readNumberEndingAt(tokens, ende)
  return zahl ? { amount: zahl.value, unit, from: zahl.from } : null
}

/** Die Zahl, die unmittelbar vor `ende` steht — als Ziffern oder als Wort. */
function readNumberEndingAt(
  tokens: string[],
  ende: number,
): { value: number; from: number } | null {
  const letztes = bare(tokens[ende - 1])

  const asDigits = digits(letztes)
  if (asDigits !== null) return { value: asDigits, from: ende - 1 }

  if (HALF_WORDS.has(letztes)) {
    // „ein halbes Kilo" — die Eins davor ist nur Grammatik und gehört mit weg.
    const davor = ende >= 2 ? bare(tokens[ende - 2]) : ''
    const eins = NUMBER_WORDS[davor] === 1
    return { value: 0.5, from: ende - (eins ? 2 : 1) }
  }

  if (letztes in NUMBER_WORDS) {
    return { value: NUMBER_WORDS[letztes], from: ende - 1 }
  }
  return null
}

/** Zutatennamen fangen groß an — die Erkennung liefert sie oft klein. */
function capitalize(name: string): string {
  return name.charAt(0).toLocaleUpperCase('de') + name.slice(1)
}

/**
 * Zerlegt einen gesprochenen Abschnitt in Zubereitungsschritte.
 *
 * In aller Regel liefert die Erkennung ohnehin einen Abschnitt je Sprechpause,
 * also einen Schritt. Wer aber am Stück durchspricht, bekommt einen Klumpen mit
 * mehreren Sätzen — der wird an den Satzenden getrennt.
 */
export function splitSpokenSteps(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/u)
    .map((part) => part.trim())
    .filter(Boolean)
    .map(capitalize)
}
