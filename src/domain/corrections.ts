/**
 * Die eigene Wörterliste für das Diktat.
 *
 * **Die Spracherkennung selbst lässt sich nicht trainieren.** Sie kommt von
 * Google, läuft auf deren Servern und nimmt keine eigenen Wörter entgegen. Was
 * geht, ist eine Übersetzung dahinter: Sie hört „Fatham", die App macht „Feta"
 * daraus. Für den Benutzer ist das Ergebnis dasselbe, der Weg ein anderer — und
 * genau das gehört gesagt, damit niemand mehr erwartet, als hier passiert.
 *
 * Gelernt wird aus Handkorrekturen: Wer einen gerade diktierten Zutatennamen
 * überschreibt, bringt der App das Paar bei.
 */

export interface Correction {
  /** Was die Erkennung geliefert hat — immer kleingeschrieben abgelegt. */
  gehoert: string
  /** Was gemeint war, in der Schreibweise, die im Feld stehen soll. */
  gemeint: string
}

/**
 * Obergrenze. Eine Liste, die nur wächst, wird irgendwann selbst zum Problem —
 * beim Anwenden und beim Ansehen. Zweihundert Wörter sind weit mehr, als ein
 * Haushalt je falsch verstanden bekommt.
 */
export const MAX_CORRECTIONS = 200

/** Ab hier ist es kein Wort mehr, sondern ein Satz. */
const MAX_LENGTH = 40

/** Vergleichsform: „Feta " und „feta" sind dasselbe Wort. */
export function normalizeWord(word: string): string {
  return word.trim().toLocaleLowerCase('de')
}

/**
 * Wendet die Liste auf einen erkannten Namen an.
 *
 * Zuerst der ganze Name — so lassen sich auch mehrteilige Verhörer geradeziehen
 * („rote zwiebel" → „Rote Zwiebeln"). Trifft das nicht, wird Wort für Wort
 * ersetzt; damit wirkt ein Eintrag auch mitten in einem längeren Namen.
 */
export function applyCorrections(
  name: string,
  list: readonly Correction[],
): string {
  if (list.length === 0) return name

  const ganz = list.find((entry) => entry.gehoert === normalizeWord(name))
  if (ganz) return ganz.gemeint

  const nachWort = new Map(list.map((entry) => [entry.gehoert, entry.gemeint]))
  return name
    .split(/(\s+)/)
    .map((teil) => nachWort.get(normalizeWord(teil)) ?? teil)
    .join('')
}

/**
 * Ein Paar aufnehmen. Gibt die neue Liste zurück, die alte bleibt unberührt.
 *
 * Abgelehnt wird, was keine Korrektur ist: leere Angaben, ein Wort, das sich
 * nur in der Groß- und Kleinschreibung unterscheidet, und ganze Sätze. Gerade
 * beim automatischen Lernen ist das wichtig — sonst sammelt die Liste Unrat an,
 * den niemand je eingetragen hätte.
 */
export function learnCorrection(
  list: readonly Correction[],
  gehoert: string,
  gemeint: string,
): Correction[] {
  const schluessel = normalizeWord(gehoert)
  const wert = gemeint.trim()

  if (!schluessel || !wert) return [...list]
  if (schluessel === normalizeWord(wert)) return [...list]
  if (schluessel.length > MAX_LENGTH || wert.length > MAX_LENGTH) return [...list]

  // Das Neueste nach vorn, ein vorhandenes Paar wird ersetzt statt verdoppelt.
  const rest = list.filter((entry) => entry.gehoert !== schluessel)
  return [{ gehoert: schluessel, gemeint: wert }, ...rest].slice(
    0,
    MAX_CORRECTIONS,
  )
}

/** Ein Paar wieder loswerden. */
export function forgetCorrection(
  list: readonly Correction[],
  gehoert: string,
): Correction[] {
  const schluessel = normalizeWord(gehoert)
  return list.filter((entry) => entry.gehoert !== schluessel)
}

/**
 * Bringt einen gelesenen Stand auf die Form der Liste.
 *
 * Was aus dem Browserspeicher kommt, ist erst einmal nur „irgendetwas" — ein
 * Stand aus einer älteren Fassung, von Hand verändert, beschädigt. Ein einzelner
 * kaputter Eintrag darf nicht die ganze Liste kosten.
 */
export function toCorrections(value: unknown): Correction[] {
  if (!Array.isArray(value)) return []
  const gesehen = new Set<string>()
  const result: Correction[] = []

  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue
    const paar = entry as Record<string, unknown>
    if (typeof paar.gehoert !== 'string' || typeof paar.gemeint !== 'string') {
      continue
    }
    const schluessel = normalizeWord(paar.gehoert)
    const wert = paar.gemeint.trim()
    if (!schluessel || !wert || gesehen.has(schluessel)) continue

    gesehen.add(schluessel)
    result.push({ gehoert: schluessel, gemeint: wert })
    if (result.length >= MAX_CORRECTIONS) break
  }

  return result
}
