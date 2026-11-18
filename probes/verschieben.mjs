/**
 * Ein Gericht durch langes Drücken auf einen anderen Tag bringen.
 *
 * Martin: „Ich kann keine Rezepte verschieben. Wie soll das gehen? Im
 * Essensplan will ich einfach das Gericht lange drücken und dann kann ich es
 * verschieben auf einen anderen Tag."
 *
 * Die wichtigste Prüfung hier ist nicht die Geste, sondern **Prüfung 3**: dass
 * ein kurzer Tipp weiterhin das Bearbeiten-Blatt öffnet. Eine zu scharf
 * eingestellte Geste frisst den normalen Tipp, und dann ist der Essensplan
 * unbedienbar — ein viel schlimmerer Schaden als ein fehlendes Verschieben.
 */

import {
  abbruch,
  einplanen,
  pruefer,
  rezept,
  starteApp,
  zumReiter,
} from './helfer.mjs'

const { pruefe, notiz, schluss } = pruefer()
const { browser, page } = await starteApp({ pruefe })

const haupt = () => page.locator('main').innerText()
const koerper = () => page.locator('body').innerText()

/** Das erste Feld einer Mahlzeit, auf dem das Gericht liegt. */
const feld = (name, mahlzeit = 'Mittagessen') =>
  page
    .locator(`button[aria-label^="${mahlzeit} am"]`)
    .filter({ hasText: name })
    .first()

/** Lange drücken: aufsetzen, liegen lassen, loslassen. */
async function langDruecken(locator) {
  const kasten = await locator.boundingBox()
  const x = kasten.x + kasten.width / 2
  const y = kasten.y + kasten.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  // Deutlich über der Schwelle von 500 ms, ohne den Finger zu bewegen.
  await page.waitForTimeout(900)
  await page.mouse.up()
  await page.waitForTimeout(600)
}

/** Auf welchen Feldern steht das Gericht gerade? */
const stehtAuf = (name) =>
  page.evaluate((gesucht) => {
    return [...document.querySelectorAll('main button[aria-label*=" am "]')]
      .filter((b) => b.textContent.includes(gesucht))
      .map((b) => b.getAttribute('aria-label').replace(' bearbeiten', ''))
  }, name)

// === Aufbau ==============================================================
await rezept(page, 'Spaghetti', {
  zutaten: [{ name: 'Nudeln', menge: 500, einheit: 'g' }],
})
await rezept(page, 'Auflauf', {
  zutaten: [{ name: 'Käse', menge: 200, einheit: 'g' }],
})
await einplanen(page, 'Spaghetti')
await zumReiter(page, 'Essensplan')

const vorher = await stehtAuf('Spaghetti')
notiz('wo Spaghetti liegt', vorher)
pruefe('das Gericht liegt auf genau einem Feld', vorher.length === 1, vorher)

// === 1 · Langer Druck öffnet das Verschieben =============================
await langDruecken(feld('Spaghetti'))
const blatt = await koerper()
notiz('nach dem langen Druck', blatt.replace(/\s+/g, ' ').slice(0, 160))
pruefe('das Blatt „Wohin damit?" steht da', blatt.includes('Wohin damit?'), blatt.slice(0, 120))
pruefe('es nennt das Gericht', blatt.includes('Spaghetti'))

await page.screenshot({
  path: new URL('109-verschieben.png', import.meta.url).pathname,
})

// === 2 · Ein anderer Tag nimmt es auf ====================================
// „Morgen, Abendbrot" — eine Zeile unter „Heute", die zweite Mahlzeit.
const morgen = page.locator('li', { hasText: 'Morgen' }).first()
await morgen.getByRole('button', { name: /^Abendbrot/ }).click()
await page.waitForTimeout(1200)
await abbruch(page)

const danach = await stehtAuf('Spaghetti')
notiz('wo Spaghetti jetzt liegt', danach)
pruefe('es liegt weiterhin auf genau einem Feld', danach.length === 1, danach)
pruefe('und zwar auf einem anderen als vorher',
  danach.length === 1 && danach[0] !== vorher[0], { vorher, danach })
pruefe('auf dem neuen Platz ist es das Abendbrot',
  /^Abendbrot/.test(danach[0] ?? ''), danach)

// === 3 · Der normale Tipp muss weiter gehen ==============================
/*
 * Die Prüfung, an der dieses Paket scheitern könnte: Verschluckt die neue
 * Geste den gewöhnlichen Tipp, kommt man an kein Feld mehr heran.
 */
await feld('Spaghetti', 'Abendbrot').click()
await page.waitForTimeout(700)
const nachTipp = await koerper()
notiz('nach kurzem Tipp', nachTipp.replace(/\s+/g, ' ').slice(0, 140))
pruefe('ein kurzer Tipp öffnet das Bearbeiten-Blatt',
  nachTipp.includes('Rezept hinzufügen'), nachTipp.slice(0, 140))
pruefe('und nicht zusätzlich das Verschieben',
  !nachTipp.includes('Wohin damit?'))
await page.getByRole('button', { name: 'Fertig' }).click()
await page.waitForTimeout(600)
await abbruch(page)

// === 4 · Zwei Gerichte auf einem Platz: erst die Auswahl ==================
/*
 * Zweimal auf **denselben** Platz. Beim ersten Versuch stand das zweite
 * Gericht an einem anderen Tag — dann liegt eben nirgends mehr als eines, und
 * die Prüfung bewies nichts.
 */
await einplanen(page, 'Auflauf')
await einplanen(page, 'Auflauf')
await zumReiter(page, 'Essensplan')
await langDruecken(feld('Auflauf', 'Mittagessen'))
const beiZwei = await koerper()
notiz('zwei Gerichte auf dem Platz', beiZwei.replace(/\s+/g, ' ').slice(0, 160))
pruefe('bei mehreren Gerichten wird erst gefragt, welches',
  beiZwei.includes('Welches Gericht?'), beiZwei.slice(0, 140))
await page.getByRole('button', { name: 'Abbrechen' }).click()
await page.waitForTimeout(500)
await abbruch(page)

// === 5 · Der Bogen zu Paket S: die Rückfrage auf der Einkaufsliste =======
/*
 * Die Geste ist für diese Regel gebaut worden. Hier hängt beides zusammen:
 * abhaken, verschieben, und auf der Einkaufsliste muss gefragt werden.
 */
await zumReiter(page, 'Einkauf')
await page
  .locator('button[aria-pressed]')
  .filter({ hasText: 'Nudeln' })
  .first()
  .click()
await page.waitForTimeout(800)
await abbruch(page)

// Spaghetti liegt seit Prüfung 2 allein auf „Morgen, Abendbrot" — dort führt
// der lange Druck ohne Zwischenfrage zur Tagesauswahl.
await zumReiter(page, 'Essensplan')
await langDruecken(feld('Spaghetti', 'Abendbrot'))
const heuteZeile = page.locator('li', { hasText: 'Heute' }).first()
await heuteZeile.getByRole('button', { name: /^Abendbrot/ }).click()
await page.waitForTimeout(1200)
await abbruch(page)

await zumReiter(page, 'Einkauf')
const liste = await haupt()
notiz('Einkaufsliste nach dem Verschieben', liste.replace(/\s+/g, ' ').slice(0, 220))
pruefe('nach dem Verschieben fragt die Einkaufsliste nach',
  liste.includes('wieder auf die Liste?'), liste.slice(0, 180))

await browser.close()
schluss()
