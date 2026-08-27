/**
 * Wer im Haushalt mitisst.
 *
 * Eine schlichte Liste von Namen, kein Konto und keine Anmeldung. Das ist
 * Absicht: Am Tisch sitzen auch Leute ohne Handy, und für die Frage „für wen
 * ist das Essen" muss die App gar nicht wissen, wer an welchem Gerät sitzt. Die
 * Liste steht im Haushalt und ist damit auf allen Geräten dieselbe.
 *
 * An einem Eintrag im Essensplan hängen die Namen als **Text**, nicht als
 * Verweis. Wer später aus der Liste gestrichen wird, steht am alten Eintrag
 * weiterhin — der Plan von letzter Woche soll nicht rückwirkend seine Bedeutung
 * verlieren.
 */

/** Länger schreibt niemand einen Rufnamen, und in die Marke passt es sonst nicht. */
export const MAX_NAME = 20

/** Mehr Namen fasst die Auswahl im Blatt nicht mehr sinnvoll. */
export const MAX_PEOPLE = 12

/** Leerraum zusammenziehen und auf die Höchstlänge kürzen. */
export function cleanPersonName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME)
}

/**
 * Einen Namen aufnehmen. Gibt die Liste unverändert zurück, wenn nichts
 * dasteht, der Name schon da ist oder die Liste voll ist.
 *
 * Verglichen wird ohne Rücksicht auf Groß- und Kleinschreibung: „martin" neben
 * „Martin" wären zwei Marken für denselben Menschen.
 */
export function addPerson(people: string[], raw: string): string[] {
  const name = cleanPersonName(raw)
  if (!name || people.length >= MAX_PEOPLE) return people
  if (people.some((person) => sameName(person, name))) return people
  return [...people, name]
}

export function removePerson(people: string[], name: string): string[] {
  return people.filter((person) => !sameName(person, name))
}

/** Einen Namen am Planeintrag an- oder abwählen. */
export function toggleEater(eaters: string[], name: string): string[] {
  return eaters.some((eater) => sameName(eater, name))
    ? eaters.filter((eater) => !sameName(eater, name))
    : [...eaters, name]
}

/**
 * Bringt eine Auswahl auf die kanonische Form.
 *
 * Sind **alle** angehakt, ist das dasselbe wie „alle" — und das wird als leere
 * Liste abgelegt, nicht als vollständige Aufzählung. Sonst gäbe es zwei
 * Schreibweisen für denselben Sachverhalt, und der Plan hinge voller Marken,
 * die nichts unterscheiden.
 */
export function normalizeEaters(eaters: string[], people: string[]): string[] {
  if (people.length < 2) return eaters
  const alleDa = people.every((person) =>
    eaters.some((eater) => sameName(eater, person)),
  )
  return alleDa ? [] : eaters
}

/**
 * Was am Eintrag im Plan steht.
 *
 * `null` heißt: nichts anzeigen. Das ist der Normalfall — es essen alle mit,
 * und eine Marke an jedem Eintrag wäre nur Lärm. Sind **alle** angehakt, steht
 * dort „alle" statt einer Aufzählung, sonst die Namen.
 */
export function eatersLabel(
  eaters: string[] | undefined,
  people: string[],
): string | null {
  const gewaehlt = eaters ?? []
  if (gewaehlt.length === 0) return null

  const alleDa =
    people.length > 1 &&
    people.every((person) => gewaehlt.some((eater) => sameName(eater, person)))
  return alleDa ? 'alle' : gewaehlt.join(', ')
}

/**
 * Bringt eine gelesene Namensliste auf Form.
 *
 * Was aus der Ablage kommt, ist erst einmal nur „irgendetwas" — ein Stand aus
 * einer älteren Fassung, ein halb geschriebenes Dokument. Alles, was kein
 * brauchbarer Name ist, fällt still weg.
 */
export function toPeople(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  let people: string[] = []
  for (const entry of value) {
    if (typeof entry === 'string') people = addPerson(people, entry)
  }
  return people
}

function sameName(a: string, b: string): boolean {
  return a.toLocaleLowerCase('de') === b.toLocaleLowerCase('de')
}
