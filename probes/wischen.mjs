/**
 * Wischen zwischen den Reitern.
 *
 * Diese Probe braucht **echte Berührungen** über CDP
 * `Input.dispatchTouchEvent`, nicht die Mausbewegungen von Playwright. Hier
 * stecken zwei Browser-Eigenheiten, die man nur so trifft:
 *
 * 1. Auf einem scrollbaren Bereich reißt der Browser die Berührung an sich und
 *    schickt `pointercancel` statt `pointerup`. Dadurch kam das Wischen am
 *    Anfang überhaupt nicht an; behoben mit `touch-action: pan-y pinch-zoom`.
 * 2. Ein Zug über 220 px galt danach noch als **Tipp** und öffnete das Rezept,
 *    über dem der Finger losgelassen wurde.
 */

import { abbruch, insRezept, pruefer, rezept, starteApp, zumReiter } from './helfer.mjs'

const { pruefe, notiz, schluss } = pruefer()
const { browser, page } = await starteApp({ pruefe })

const cdp = await page.context().newCDPSession(page)

/** Eine Wischbewegung mit echten Berührungspunkten. */
async function wischen({ vonX, nachX, y = 420, schritte = 12 }) {
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: vonX, y }],
  })
  for (let i = 1; i <= schritte; i += 1) {
    const x = vonX + ((nachX - vonX) * i) / schritte
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y }],
    })
    await page.waitForTimeout(12)
  }
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })
  await page.waitForTimeout(600)
}

const nachLinks = () => wischen({ vonX: 330, nachX: 60 })
const nachRechts = () => wischen({ vonX: 60, nachX: 330 })

/** Welcher Reiter ist an? Die Leiste markiert ihn über aria-current. */
const reiter = () =>
  page.locator('nav a[aria-current="page"], footer a[aria-current="page"]')
    .first()
    .innerText()
    .catch(() => '?')

// Ein Rezept, damit das Rezeptbuch nicht leer ist — ein leerer Reiter scrollt
// nicht und würde die eigentliche Eigenheit gar nicht auslösen.
await rezept(page, 'Bolognese', {
  zutaten: [{ name: 'Hackfleisch', menge: 500, einheit: 'g' }],
  schritte: ['Zwiebeln würfeln.'],
})
await zumReiter(page, 'Rezepte')

pruefe('wir fangen im Rezeptbuch an', (await reiter()).includes('Rezepte'),
  await reiter())

// === 1 · Vorwärts durch die drei Reiter ==================================
await nachLinks()
await abbruch(page)
notiz('nach einem Wisch nach links', await reiter())
pruefe('ein Wisch nach links führt zum Essensplan',
  (await reiter()).includes('Essensplan'), await reiter())

await nachLinks()
await abbruch(page)
pruefe('noch einer zur Einkaufsliste',
  (await reiter()).includes('Einkauf'), await reiter())

// === 2 · Am Ende ist Schluss — kein Umlauf ===============================
await nachLinks()
await abbruch(page)
pruefe('am letzten Reiter geht es nicht im Kreis weiter',
  (await reiter()).includes('Einkauf'), await reiter())

// === 3 · Und zurück ======================================================
await nachRechts()
pruefe('ein Wisch nach rechts führt zurück zum Essensplan',
  (await reiter()).includes('Essensplan'), await reiter())
await nachRechts()
pruefe('und weiter ins Rezeptbuch',
  (await reiter()).includes('Rezepte'), await reiter())
await nachRechts()
pruefe('auch am ersten Reiter ist Schluss',
  (await reiter()).includes('Rezepte'), await reiter())

// === 4 · Ein Zug darf kein Tipp sein =====================================
/**
 * Der Fehler, der nach der ersten Reparatur noch da war: Der Wisch wechselte
 * den Reiter **und** öffnete das Rezept, über dem der Finger lag.
 */
pruefe('ein Wisch hat kein Rezept geöffnet',
  !(await page.locator('body').innerText()).includes('Zwiebeln würfeln.'),
  (await page.locator('body').innerText()).slice(0, 150))

// Der Tipp selbst muss aber weiter funktionieren.
await insRezept(page, 'Bolognese')
pruefe('ein echter Tipp öffnet das Rezept weiterhin',
  (await page.locator('body').innerText()).includes('Zwiebeln würfeln.'))
await page.getByRole('button', { name: 'Zurück' }).first().click()
await page.waitForTimeout(500)

// === 5 · Senkrechtes Scrollen wechselt nicht den Reiter ==================
const vorher = await reiter()
await wischen({ vonX: 195, nachX: 195, y: 420, schritte: 1 })
await cdp.send('Input.dispatchTouchEvent', {
  type: 'touchStart',
  touchPoints: [{ x: 195, y: 600 }],
})
for (const y of [540, 480, 420, 360, 300]) {
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: 195, y }],
  })
  await page.waitForTimeout(12)
}
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
await page.waitForTimeout(600)
pruefe('senkrechtes Scrollen wechselt den Reiter nicht',
  (await reiter()) === vorher, { vorher, jetzt: await reiter() })

await page.screenshot({ path: new URL('95-wischen.png', import.meta.url).pathname })

await browser.close()
schluss()
