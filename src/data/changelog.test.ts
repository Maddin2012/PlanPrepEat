import { describe, expect, it } from 'vitest'
import {
  CHANGELOG,
  KIND_LABELS,
  pendingEntries,
  toChangelog,
  type ChangeEntry,
} from './changelog.ts'

/**
 * Die Notizen kommen zum Teil über das Netz — von einer **neueren** Fassung der
 * App, die diese hier nie gesehen hat. Was von dort kommt, ist erst einmal nur
 * „irgendetwas". Scheitert die Anzeige daran, steht der Update-Knopf zwar noch
 * da, aber die Einstellungen wären kaputt.
 */

function eintrag(overrides: Partial<ChangeEntry> = {}): ChangeEntry {
  return { datum: '2026-08-26', art: 'neu', text: 'Etwas Neues.', ...overrides }
}

describe('CHANGELOG', () => {
  it('ist nicht leer und hat für jede Art eine Beschriftung', () => {
    expect(CHANGELOG.length).toBeGreaterThan(0)
    for (const entry of CHANGELOG) {
      expect(KIND_LABELS[entry.art]).toBeTruthy()
    }
  })

  it('steht mit dem Neuesten oben', () => {
    // Sonst zeigten die Einstellungen die ältesten fünf statt der neuesten.
    const daten = CHANGELOG.map((entry) => entry.datum)
    expect(daten).toEqual([...daten].sort().reverse())
  })

  it('erklärt in ganzen Sätzen, nicht in Stichworten', () => {
    for (const entry of CHANGELOG) {
      expect(entry.text.length).toBeGreaterThan(20)
      expect(entry.text.endsWith('.')).toBe(true)
    }
  })
})

describe('toChangelog', () => {
  it('lässt brauchbare Einträge durch', () => {
    expect(toChangelog([eintrag()])).toHaveLength(1)
  })

  it('wirft einzelne kaputte Einträge weg, statt alles zu verwerfen', () => {
    const gemischt = [
      eintrag(),
      { datum: '2026-08-26' },
      { datum: 7, art: 'neu', text: 'Zahl statt Datum' },
      eintrag({ art: 'quatsch' as ChangeEntry['art'] }),
      eintrag({ text: '   ' }),
      eintrag({ art: 'fehler', text: 'Noch einer.' }),
    ]
    expect(toChangelog(gemischt)).toHaveLength(2)
  })

  it('verkraftet alles, was kein Array ist', () => {
    for (const value of [null, undefined, 42, 'text', {}, true]) {
      expect(toChangelog(value)).toEqual([])
    }
  })
})

describe('pendingEntries', () => {
  it('nennt nur, was die eingebaute Liste noch nicht kennt', () => {
    const bekannt = [eintrag({ text: 'Alt.' })]
    const live = [eintrag({ text: 'Neu.' }), eintrag({ text: 'Alt.' })]
    expect(pendingEntries(live, bekannt)).toEqual([eintrag({ text: 'Neu.' })])
  })

  it('vergleicht über den Inhalt, nicht über die Position', () => {
    // Zwischen zwei Fassungen kommt oben etwas dazu — dann verschiebt sich
    // alles darunter, und ein Vergleich nach Position meldete lauter Neues.
    const bekannt = [eintrag({ text: 'A.' }), eintrag({ text: 'B.' })]
    const live = [
      eintrag({ text: 'Ganz neu.' }),
      eintrag({ text: 'A.' }),
      eintrag({ text: 'B.' }),
    ]
    expect(pendingEntries(live, bekannt)).toHaveLength(1)
  })

  it('unterscheidet gleichlautende Texte an verschiedenen Tagen', () => {
    const bekannt = [eintrag({ datum: '2026-08-01', text: 'Kleinkram.' })]
    const live = [eintrag({ datum: '2026-08-26', text: 'Kleinkram.' })]
    expect(pendingEntries(live, bekannt)).toHaveLength(1)
  })

  it('meldet nichts, wenn beide Listen gleich sind', () => {
    expect(pendingEntries(CHANGELOG, CHANGELOG)).toEqual([])
  })
})
