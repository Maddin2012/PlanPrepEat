import type { ShoppingItem } from './types.ts'

/**
 * Namen auf der Einkaufsliste: wiederfinden und vorschlagen.
 *
 * Beides ist reine Rechnerei und steht deshalb hier statt in der Oberfläche —
 * „ist das derselbe Posten?" und „passt dieser Name zu dem, was da getippt
 * wurde?" sind Fragen, die man ohne Browser beantworten kann und soll.
 */

/**
 * Zwei Namen, die denselben Posten meinen.
 *
 * Verglichen wird ohne Rücksicht auf Groß- und Kleinschreibung und auf Akzente
 * — dieselbe Regel, nach der die Liste ohnehin sortiert (`shoppingComparator`).
 * **Nicht** verglichen wird auf Teilstücke: „Avocado" und „Avocadocreme" sind
 * zwei verschiedene Dinge, und ein zu großzügiger Vergleich verschmölze
 * Posten, die nichts miteinander zu tun haben.
 */
export function sameItemName(a: string, b: string): boolean {
  return a.trim().localeCompare(b.trim(), 'de', { sensitivity: 'base' }) === 0
}

/**
 * Der Schlüssel eines Postens, der schon auf der Liste steht — oder `null`.
 *
 * Gesucht wird über den **Namen**, nicht über den Schlüssel: Ein von Hand
 * getipptes „Avocado" und eine Avocado aus einem Rezept haben grundverschiedene
 * Schlüssel (`manual|…` gegen `zutat|stk`), meinen aber dasselbe. Genau daran
 * sind bisher die doppelten Zeilen entstanden.
 */
export function findByName(
  items: readonly ShoppingItem[],
  name: string,
): string | null {
  const gesucht = name.trim()
  if (!gesucht) return null
  return items.find((item) => sameItemName(item.name, gesucht))?.key ?? null
}

/**
 * Vorschläge zu einer Eingabe, in drei Rängen.
 *
 * 1. Was **so anfängt** wie die Eingabe: „avo" → „Avocado".
 * 2. Was ein **Wort darin** so anfängt: „creme" → „Saure Creme".
 * 3. Was die Buchstaben **der Reihe nach** enthält: „AVC" → „**A**vo**c**ado".
 *
 * Der dritte Rang ist der eigentliche Wunsch und der Grund, warum hier etwas
 * Eigenes steht statt eines `<datalist>` wie im Rezeptformular: Das vergleicht
 * nur Anfang und Teilstück, „AVC" fände damit nichts.
 *
 * Innerhalb eines Ranges wird alphabetisch sortiert, damit die Liste bei
 * gleichwertigen Treffern nicht springt.
 */
export function suggestNames(
  names: readonly string[],
  query: string,
  limit = 5,
): string[] {
  const gesucht = fold(query)
  if (!gesucht) return []

  const getroffen: { name: string; rang: number }[] = []
  const gesehen = new Set<string>()

  for (const name of names) {
    const gefaltet = fold(name)
    // Dieselbe Zutat kann aus dem Katalog und von der Liste kommen.
    if (!gefaltet || gesehen.has(gefaltet)) continue

    const rang = rankOf(gefaltet, gesucht)
    if (rang === null) continue

    gesehen.add(gefaltet)
    getroffen.push({ name, rang })
  }

  return getroffen
    .sort((a, b) =>
      a.rang !== b.rang ? a.rang - b.rang : a.name.localeCompare(b.name, 'de'),
    )
    .slice(0, limit)
    .map((treffer) => treffer.name)
}

function rankOf(name: string, query: string): number | null {
  if (name.startsWith(query)) return 0
  if (name.split(' ').some((wort) => wort.startsWith(query))) return 1
  return containsInOrder(name, query) ? 2 : null
}

/** Stecken die Buchstaben der Eingabe der Reihe nach im Namen? */
function containsInOrder(name: string, query: string): boolean {
  let stelle = 0
  for (const buchstabe of query) {
    stelle = name.indexOf(buchstabe, stelle)
    if (stelle === -1) return false
    stelle += 1
  }
  return true
}

/**
 * Kleinschreibung ohne Akzente, damit „Möhre" auch auf „mohre" anspringt.
 *
 * `normalize('NFD')` zerlegt Umlaute in Buchstabe plus Zeichen, der Ersatz
 * wirft die Zeichen weg. Das deutsche ß bleibt dabei ß — wer „strasse" tippt,
 * findet „Straße" nicht. Für eine Einkaufsliste ist das zu verschmerzen.
 */
function fold(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('de')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}
