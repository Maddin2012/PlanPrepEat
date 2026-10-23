/**
 * Wasserzeichen und aufgeräumte Einstellungen.
 *
 * Das Wasserzeichen ist der heikelste Teil der Kosmetik, weil es hinter dem
 * Text liegt: Ein zu heller Ton frisst die Lesereserve der Schrift auf. Die
 * Lösung war, es **dunkler als den Grund** zu machen — dann kann es die
 * Lesbarkeit gar nicht verschlechtern, nur verbessern. Genau das wird hier
 * gemessen, nicht angesehen.
 *
 * Zwei Fallen aus der Entstehung, die diese Probe mit abdeckt:
 * ein festes Element malt über allen gewöhnlichen Inhalt (daher die negative
 * Ebene plus `isolate`), und in einem `fullPage`-Bildschirmfoto zeichnet
 * Chromium feste Elemente anders — es wird deshalb nur das Sichtfeld
 * fotografiert.
 */

import { abbruch, pruefer, starteApp, zumReiter } from './helfer.mjs'

const { pruefe, notiz, schluss } = pruefer()
const { browser, page } = await starteApp({ pruefe })

const wasserzeichen = () => page.locator('div[aria-hidden="true"]:has(svg)').first()

// === 1 · Nur in der dunklen Fassung ======================================
await zumReiter(page, 'Rezepte')
pruefe('in der dunklen Fassung ist das Wasserzeichen da',
  await wasserzeichen().isVisible())

/** Die Farben, die der Browser wirklich zeichnet. */
const toene = await page.evaluate(() => {
  const zeichen = document.querySelector('div[aria-hidden="true"] svg')
  const grund = document.querySelector('.bg-canvas') ?? document.body
  return {
    zeichen: getComputedStyle(zeichen).color,
    grund: getComputedStyle(grund).backgroundColor,
    ebene: getComputedStyle(zeichen.parentElement).zIndex,
  }
})
notiz('Töne', toene)

/** Helligkeit nach der Formel, mit der auch der Kontrast gerechnet wird. */
function helligkeit(rgb) {
  const [r, g, b] = rgb.match(/\d+/g).slice(0, 3).map(Number)
  const lin = (c) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

const hellZeichen = helligkeit(toene.zeichen)
const hellGrund = helligkeit(toene.grund)
notiz('Helligkeit', { zeichen: hellZeichen.toFixed(4), grund: hellGrund.toFixed(4) })

pruefe('das Wasserzeichen ist DUNKLER als der Grund — es kann die Schrift darüber nicht schlechter machen',
  hellZeichen < hellGrund, { zeichen: hellZeichen, grund: hellGrund })
pruefe('es liegt auf einer negativen Ebene, also hinter dem Inhalt',
  Number(toene.ebene) < 0, toene.ebene)

// --- Und der Text darüber bleibt lesbar ---------------------------------
const textKontrast = await page.evaluate(() => {
  const el = [...document.querySelectorAll('main *')]
    .find((e) => e.textContent.trim() && e.children.length === 0)
  return el ? getComputedStyle(el).color : null
})
notiz('Textfarbe über dem Grund', textKontrast)
const verhaeltnis =
  (Math.max(helligkeit(textKontrast), hellGrund) + 0.05) /
  (Math.min(helligkeit(textKontrast), hellGrund) + 0.05)
notiz('Kontrast Text zu Grund', verhaeltnis.toFixed(2))
pruefe('der Text über dem Grund erreicht die Lesbarkeitsschwelle 4,5',
  verhaeltnis >= 4.5, verhaeltnis.toFixed(2))

// Nur das Sichtfeld: In einem fullPage-Foto zeichnet Chromium feste Elemente
// anders, und daran habe ich schon einmal ein Problem gesucht, das es nicht gab.
await page.screenshot({ path: new URL('93-kosmetik.png', import.meta.url).pathname })

// === 2 · In der hellen Fassung nicht ====================================
await page.getByRole('link', { name: 'Einstellungen' }).click()
await page.waitForTimeout(600)
await page.getByRole('radio', { name: 'Hell' }).click()
await page.waitForTimeout(500)
pruefe('in der hellen Fassung ist es ausgeblendet',
  !(await wasserzeichen().isVisible()))
await page.getByRole('radio', { name: 'Dunkel' }).click()
await page.waitForTimeout(400)
await abbruch(page)

// === 3 · Die Einstellungen sind aufgeräumt ==============================
const hoehe = await page.evaluate(() => document.querySelector('main')?.scrollHeight ?? 0)
notiz('Höhe der Einstellungen', hoehe)
pruefe('die Seite ist kürzer als der Bildschirm mal drei', hoehe < 844 * 3, { hoehe })

const seite = await page.locator('body').innerText()
/**
 * **„Stimme fürs Vorlesen" steht hier absichtlich nicht dabei.** Dieser
 * Behälter hat keine deutsche Stimme, und dann erscheint der Abschnitt
 * richtigerweise gar nicht (so in Paket K entschieden). Geprüft wird er in
 * `vorlesen.mjs`, wo eine Stimmen-Attrappe läuft.
 */
for (const titel of [
  'Eigene Wörter',
  'Ladenreihenfolge',
  'Sicherung',
  'Verbindung',
]) {
  pruefe(`„${titel}" steht noch da`, seite.includes(titel))
}
pruefe('ohne deutsche Stimme fehlt der Stimmen-Abschnitt — wie vorgesehen',
  (await page.locator('summary', { hasText: 'Stimme fürs Vorlesen' }).count()) === 0)

// Zugeklappt ist der Inhalt nicht sichtbar, nach dem Tippen schon.
const sicherung = page.locator('details', { hasText: 'Sicherung' }).first()
pruefe('zugeklappt sieht man den Inhalt nicht',
  !(await sicherung.getByRole('button', { name: /sichern|Noch keine Rezepte/ }).isVisible()))
await sicherung.locator('summary').first().click()
await page.waitForTimeout(400)
await abbruch(page)
pruefe('ein Tipp klappt ihn auf',
  await sicherung.getByRole('button', { name: /sichern|Noch keine Rezepte/ }).isVisible())

pruefe('offene Abschnitte bleiben offen — Haushalt und Darstellung',
  seite.includes('Haushalts-Code') || seite.includes('nur für dieses Gerät'))

await browser.close()
schluss()
