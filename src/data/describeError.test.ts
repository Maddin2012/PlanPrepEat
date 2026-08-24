import { describe, expect, it } from 'vitest'
import { describeError } from './RepositoryContext.tsx'

/**
 * Beim Einrichten von Firebase ist diese Übersetzung das Einzige, was der
 * Benutzer zu sehen bekommt. Jeder der drei Fälle entspricht einem Schritt der
 * Anleitung, der übersprungen werden kann — der Satz muss zum Schritt führen.
 */

/** Firebase wirft Error-Objekte, deren Ursache in der Meldung steckt. */
function firebaseFehler(code: string): Error {
  return new Error(`Firebase: Error (${code}).`)
}

describe('describeError', () => {
  it('schickt bei verweigertem Zugriff zu den Sicherheitsregeln', () => {
    expect(describeError(firebaseFehler('permission-denied'))).toContain(
      'Sicherheitsregeln',
    )
  })

  it('nennt die nicht aktivierte anonyme Anmeldung beim Namen', () => {
    expect(
      describeError(firebaseFehler('auth/configuration-not-found')),
    ).toContain('anonyme Anmeldung')
  })

  it('erklärt einen falschen Schlüssel und erinnert an den neuen Bau', () => {
    for (const code of [
      'auth/invalid-api-key',
      'auth/api-key-not-valid',
      'auth/invalid-credential',
    ]) {
      const satz = describeError(firebaseFehler(code))
      expect(satz).toContain('Zugangsdaten')
      // Der häufigste Grund ist nicht ein Tippfehler, sondern ein Bau, der
      // vor dem Anlegen der Secrets lief.
      expect(satz).toContain('neu gelaufen')
    }
  })

  it('reicht die Meldung eines unbekannten Haushalts unverändert durch', () => {
    const fehler = new Error('Diesen Haushalt gibt es nicht.')
    fehler.name = 'HouseholdNotFoundError'
    expect(describeError(fehler)).toBe('Diesen Haushalt gibt es nicht.')
  })

  it('verschluckt einen unbekannten Fehler nicht, sondern zeigt ihn', () => {
    expect(describeError(new Error('irgendwas Unerwartetes'))).toBe(
      'irgendwas Unerwartetes',
    )
  })

  it('kommt mit etwas zurecht, das gar kein Fehlerobjekt ist', () => {
    expect(describeError('nur ein String')).toBe('Unbekannter Fehler.')
    expect(describeError(undefined)).toBe('Unbekannter Fehler.')
  })
})
