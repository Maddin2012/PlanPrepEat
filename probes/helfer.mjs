import { chromium } from 'playwright'

/**
 * Das Gemeinsame aller Proben.
 *
 * Vorher stand das in jeder Datei neu, und bei jeder neuen Probe habe ich die
 * Knopfnamen wieder erraten — beim letzten Mal vier Anläufe, bis „Zutat" als
 * Auswahlliste und nicht als Textfeld erkannt war. Hier steht es **einmal**
 * richtig.
 */

/** Dieselbe Größe wie ein gewöhnliches Handy. */
export const SCHIRM = { width: 390, height: 844 }

/** Das Gold der App — `--color-accent` in der dunklen Fassung. */
export const GOLD = 'rgb(200, 163, 74)'

/** Sammelt die Ergebnisse einer Probe. */
export function pruefer() {
  const fehler = []
  return {
    pruefe(name, ok, daten = '') {
      const text = daten ? ' — ' + JSON.stringify(daten).slice(0, 220) : ''
      console.log(`${ok ? '  ok  ' : ' FEHL '} ${name}${text}`)
      if (!ok) fehler.push(name)
    },
    notiz(name, wert) {
      console.log(`   [gemessen] ${name}: ${JSON.stringify(wert).slice(0, 220)}`)
    },
    /** Am Ende aufrufen: beendet den Vorgang mit dem richtigen Code. */
    schluss() {
      console.log(fehler.length === 0 ? 'ALLES GRÜN' : `${fehler.length} FEHLER`)
      process.exit(fehler.length === 0 ? 0 : 1)
    },
  }
}

/**
 * Browser und Seite aufsetzen.
 *
 * `initSkript` wird vor allem anderen im Browser ausgeführt — damit lässt sich
 * etwa die Sprachausgabe durch eine Attrappe ersetzen, **bevor** die App
 * nachsieht, ob es eine gibt.
 */
export async function starteApp({ ort, initSkript, pruefe } = {}) {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
  })
  const context = await browser.newContext({
    viewport: SCHIRM,
    isMobile: true,
    hasTouch: true,
  })
  const page = await context.newPage()

  if (pruefe) {
    page.on('pageerror', (e) =>
      pruefe('Kein Fehler im Browser', false, e.message),
    )
  }

  await page.goto(initSkript ? 'about:blank' : (ort ?? ORT))
  if (initSkript) {
    await page.addInitScript(initSkript)
    await page.goto(ort ?? ORT)
  }

  // „Nur auf diesem Gerät" — kein Haushalt, keine Firebase-Zugangsdaten nötig.
  await page.getByRole('button', { name: /Gerät starten|allein ausprobieren/ }).click()
  await page.waitForTimeout(500)
  return { browser, page }
}

export const ORT = process.env.PROBE_ORT ?? 'http://localhost:4179/'

/**
 * Harter Abbruch, wenn die App in den Fehlerbildschirm gelaufen ist.
 *
 * Ohne das liefen die Prüfungen danach ins Leere und meldeten irgendetwas —
 * ein weißer Reiter ist aber kein Prüfergebnis, sondern ein Abbruchgrund.
 */
export async function abbruch(page) {
  const text = await page.locator('body').innerText()
  if (text.includes('Hier ist etwas schiefgegangen')) {
    console.log('ABBRUCH — die App ist abgestürzt:\n' + text.slice(0, 600))
    process.exit(1)
  }
  return text
}

/**
 * Ein Rezept anlegen.
 *
 * Die Zutatenzeile hat **drei** Felder: „Zutat" (eine Auswahlliste mit
 * Vorschlägen, deshalb über das Label und nicht über die Rolle angesprochen),
 * „Menge" und „Einheit".
 */
export async function rezept(page, name, { zutaten = [], schritte = [] } = {}) {
  await page.getByRole('link', { name: 'Rezepte' }).click()
  await page.waitForTimeout(500)
  await page
    .getByRole('link', { name: /Erstes Rezept anlegen|Rezept hinzufügen/ })
    .first()
    .click()
  await page.waitForTimeout(400)
  await page.getByLabel('Name', { exact: true }).fill(name)

  for (const [index, zutat] of zutaten.entries()) {
    if (index > 0) {
      await page.getByRole('button', { name: 'Zutat hinzufügen' }).click()
      await page.waitForTimeout(250)
    }
    await page.getByLabel('Zutat', { exact: true }).nth(index).fill(zutat.name)
    await page.getByLabel('Menge', { exact: true }).nth(index).fill(String(zutat.menge))
    await page.getByLabel('Einheit', { exact: true }).nth(index).selectOption(zutat.einheit)
    await page.waitForTimeout(150)
  }

  for (const [index, schritt] of schritte.entries()) {
    if (index > 0) {
      await page.getByRole('button', { name: 'Schritt hinzufügen' }).click()
      await page.waitForTimeout(200)
    }
    await page.getByRole('textbox', { name: `Schritt ${index + 1}` }).fill(schritt)
  }

  await page.getByRole('button', { name: 'Speichern' }).click()
  await page.waitForTimeout(900)
  await abbruch(page)
  await page.getByRole('button', { name: 'Zurück' }).first().click()
  await page.waitForTimeout(500)
}

/**
 * Das Rezept auf heute legen.
 *
 * Über das Pluszeichen in der Kachel. Das Einplan-Blatt beschriftet die Knöpfe
 * nur mit der Mahlzeit, und die erste Zeile ist „Heute" — es wird also der
 * erste „Mittagessen"-Knopf im Blatt genommen, nicht ein Datum gesucht.
 */
export async function einplanen(page, name, mahlzeit = 'Mittagessen') {
  await page.getByRole('link', { name: 'Rezepte' }).click()
  await page.waitForTimeout(500)
  const kachel = page.locator('li', { hasText: name }).first()
  await kachel.getByRole('button', { name: /Einplanen|Zum Essensplan/ }).first().click()
  await page.waitForTimeout(700)
  await page
    .getByRole('dialog')
    .getByRole('button', { name: new RegExp(`^${mahlzeit}`) })
    .first()
    .click()
  await page.waitForTimeout(900)
  await abbruch(page)
}

/** Zu einem der drei Reiter. Die Leiste heißt „Einkauf", nicht „Einkaufsliste". */
export async function zumReiter(page, reiter) {
  await page.getByRole('link', { name: reiter }).click()
  await page.waitForTimeout(700)
  return abbruch(page)
}

/** Ins Rezept hinein, von der Kachelübersicht aus. */
export async function insRezept(page, name) {
  await page.getByRole('link', { name: new RegExp(name) }).first().click()
  await page.waitForTimeout(600)
}

/** Das Datum von heute, so wie es im Essensplan steht: „23.10". */
export function heuteLabel(now = new Date()) {
  const tag = String(now.getDate()).padStart(2, '0')
  const monat = String(now.getMonth() + 1).padStart(2, '0')
  return `${tag}.${monat}`
}

/** Die gezeichnete Umrandung eines Elements — Ring **und** Rand. */
export function rahmenVon(locator) {
  return locator.evaluate((el) => {
    const stil = getComputedStyle(el)
    // Der Ring von Tailwind ist ein Schatten, kein Rand — deshalb beides.
    return {
      schatten: stil.boxShadow,
      randFarbe: stil.borderColor,
      randArt: stil.borderStyle,
    }
  })
}
