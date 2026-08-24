import { describe, expect, it } from 'vitest'
import { REQUIRED_CONFIG, missingConfig } from './firebase.ts'

/**
 * Diese Prüfung entscheidet, ob die App sich für eingerichtet hält. Liegt sie
 * falsch, startet Firebase halb und scheitert später an einer Stelle, die
 * nicht auf die Ursache zeigt — beim Einrichten der teuerste Fehler.
 */

const VOLLSTÄNDIG = {
  apiKey: 'AIza-beispiel',
  authDomain: 'beispiel.firebaseapp.com',
  projectId: 'beispiel',
  appId: '1:2:web:3',
}

describe('missingConfig', () => {
  it('meldet nichts, wenn alle vier Werte dastehen', () => {
    expect(missingConfig(VOLLSTÄNDIG)).toEqual([])
  })

  it('meldet jeden einzelnen fehlenden Wert mit dem Namen seines Secrets', () => {
    for (const { key, secret } of REQUIRED_CONFIG) {
      expect(missingConfig({ ...VOLLSTÄNDIG, [key]: undefined })).toEqual([secret])
    }
  })

  it('erkennt authDomain als nötig', () => {
    // Der Fall, der vorher durchrutschte: Firebase startet, aber die anonyme
    // Anmeldung scheitert danach mit einer nichtssagenden Meldung.
    expect(missingConfig({ ...VOLLSTÄNDIG, authDomain: '' })).toEqual([
      'VITE_FB_AUTH_DOMAIN',
    ])
  })

  it('zählt Leerzeichen nicht als Wert', () => {
    // Ein aus Versehen mit Leerzeichen angelegtes Secret ist kein Wert.
    expect(missingConfig({ ...VOLLSTÄNDIG, projectId: '   ' })).toEqual([
      'VITE_FB_PROJECT_ID',
    ])
  })

  it('meldet bei leerer Konfiguration alle vier', () => {
    expect(missingConfig({})).toEqual([
      'VITE_FB_API_KEY',
      'VITE_FB_AUTH_DOMAIN',
      'VITE_FB_PROJECT_ID',
      'VITE_FB_APP_ID',
    ])
  })

  it('stört sich nicht an messagingSenderId', () => {
    // Der wird nur für Push gebraucht; ohne ihn läuft alles, was die App tut.
    expect(missingConfig(VOLLSTÄNDIG)).toEqual([])
  })
})
