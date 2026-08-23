// Nur diese Datei greift auf das Dateisystem zu. Die Node-Typen deshalb hier
// gezielt holen, statt sie in tsconfig.app.json der ganzen App zu geben — dort
// wären `process` und `fs` plötzlich überall gültig, obwohl sie im Browser
// nicht existieren.
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  GABEL_KOPF,
  MESSER_KLINGE,
  ZEICHEN_DREHUNG,
  ZEICHEN_MASSSTAB,
} from './Logo.tsx'

/**
 * Das Zeichen liegt zweimal: hier für die Oberfläche, in `scripts/icons.mjs`
 * für die Symboldateien. Zusammenlegen geht nicht — das Skript lädt Playwright
 * und darf nicht ins Bündel; Playwright ist zudem keine deklarierte
 * Abhängigkeit, ein `import` daraus würde im Veröffentlichungslauf scheitern.
 *
 * Deshalb wird die Datei als **Text** gelesen und wörtlich verglichen. Ändert
 * jemand eine der beiden Seiten allein, wird dieser Test rot — statt dass in
 * der Kopfzeile ein anderes Logo steht als auf dem Startbildschirm.
 *
 * Der Pfad geht vom Projektstamm aus, nicht von `import.meta.url`: Unter jsdom
 * ist das eine http-Adresse, keine Datei.
 */
const QUELLE = readFileSync(resolve(process.cwd(), 'scripts/icons.mjs'), 'utf8')

describe('Logo und App-Symbol', () => {
  it('zeichnet dieselbe Klinge', () => {
    expect(QUELLE).toContain(MESSER_KLINGE)
  })

  it('zeichnet denselben Gabelkopf', () => {
    expect(QUELLE).toContain(GABEL_KOPF)
  })

  it('kreuzt das Besteck im selben Winkel und Maßstab', () => {
    expect(QUELLE).toContain(`rotate(-${ZEICHEN_DREHUNG}) scale(${ZEICHEN_MASSSTAB})`)
    expect(QUELLE).toContain(`rotate(${ZEICHEN_DREHUNG}) scale(${ZEICHEN_MASSSTAB})`)
  })

  it('findet die Skriptdatei überhaupt', () => {
    // Ohne das würde ein verschobenes Skript die drei Prüfungen oben nicht rot
    // machen, sondern den Lauf mit einem Lesefehler abbrechen — und ein leerer
    // String würde jeden `toContain` bestehen lassen.
    expect(QUELLE.length).toBeGreaterThan(2000)
  })
})
