/** Zufällige Kennung für Rezepte, Zutaten, Pläne und Haushalte. */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replaceAll('-', '').slice(0, 20)
  }
  return Math.random().toString(36).slice(2).padEnd(20, '0').slice(0, 20)
}

// Ohne I, l, O und 0 — die verwechselt man beim Abtippen vom anderen Handy.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/**
 * Kennung eines Haushalts. Sie ist zugleich der Einladungscode und damit das
 * Geheimnis, das die beiden Geräte verbindet — deshalb 16 Zeichen aus einem
 * Alphabet ohne Verwechslungsgefahr, in Vierergruppen darstellbar.
 */
export function newHouseholdId(): string {
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  return [...bytes]
    .map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length])
    .join('')
}

/** „ABCD-EFGH-JKMN-PQRS" — so liest man ihn dem anderen leichter vor. */
export function formatHouseholdCode(id: string): string {
  return (id.match(/.{1,4}/g) ?? [id]).join('-')
}

/** Nimmt Bindestriche, Leerzeichen und Kleinschreibung beim Eintippen hin. */
export function normalizeHouseholdCode(input: string): string {
  return input.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}
