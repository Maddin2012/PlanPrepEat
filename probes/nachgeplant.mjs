/**
 * Ein neu eingeplantes Gericht bringt seine Zutaten zurück.
 *
 * Martins Meldung vom 18.11.: Der Wocheneinkauf war erledigt, die Nudeln
 * abgehakt. Dann kam ein neues Nudelgericht in den Plan — und die Nudeln
 * standen nicht auf der Liste, sie mussten von Hand nachgetragen werden.
 *
 * **Der entscheidende Teil ist, dass das alte Gericht verschwindet.** Bleibt es
 * stehen, wächst die Gesamtmenge, und schon die alte Fassung holte die Zutat
 * zurück. Erst wenn das gegessene Gericht weg ist — aus dem Plan genommen oder
 * aus dem 12-Tage-Fenster gefallen — steht Menge gegen Menge, `500 > 500` ist
 * falsch, und das Häkchen blieb fälschlich stehen. Genau das wird hier
 * nachgestellt.
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

/** Eine Zeile der Einkaufsliste ausmessen — samt Stelle im Baum. */
const zeile = (name) =>
  page.evaluate((gesucht) => {
    const knopf = [
      ...document.querySelectorAll('main button[aria-label$=" bearbeiten"]'),
    ].find((b) => b.getAttribute('aria-label') === `${gesucht} bearbeiten`)
    if (!knopf) return null
    const reihe = knopf.closest('li')
    const erledigt = [...document.querySelectorAll('main section')].some(
      (s) => s.textContent.includes('Erledigt (') && s.contains(knopf),
    )
    return {
      menge: knopf.textContent.trim(),
      text: reihe.textContent.replace(/\s+/g, ' ').trim(),
      abgehakt:
        reihe
          .querySelector('button[aria-pressed]')
          ?.getAttribute('aria-pressed') === 'true',
      offen: !erledigt,
    }
  }, name)

const umhaken = async (name) => {
  await page
    .locator('button[aria-pressed]')
    .filter({ hasText: name })
    .first()
    .click()
  await page.waitForTimeout(700)
}

/** Ein Gericht wieder aus dem Plan nehmen. */
async function vomPlanNehmen(name, mahlzeit = 'Mittagessen') {
  await zumReiter(page, 'Essensplan')
  await page
    .locator(`button[aria-label^="${mahlzeit} am"]`)
    .filter({ hasText: name })
    .first()
    .click()
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: 'Vom Plan nehmen' }).first().click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'Fertig' }).click()
  await page.waitForTimeout(800)
  await abbruch(page)
}

// === Aufbau: Spaghetti einplanen und einkaufen =============================
const nudeln = [{ name: 'Nudeln', menge: 500, einheit: 'g' }]
await rezept(page, 'Spaghetti', { zutaten: nudeln })
await rezept(page, 'Nudelauflauf', { zutaten: nudeln })

await einplanen(page, 'Spaghetti')
await zumReiter(page, 'Einkauf')

const vorher = await zeile('Nudeln')
notiz('nach dem Einplanen von Spaghetti', vorher)
pruefe('die Nudeln stehen offen auf der Liste', vorher?.offen === true, vorher)

await umhaken('Nudeln')
await abbruch(page)
const abgehakt = await zeile('Nudeln')
notiz('nach dem Abhaken', abgehakt)
pruefe(
  'abgehakt rutschen sie in den Erledigt-Block',
  abgehakt?.abgehakt === true && abgehakt?.offen === false,
  abgehakt,
)

// === Gegessen: das Gericht ist aus dem Plan verschwunden ===================
await vomPlanNehmen('Spaghetti')
await zumReiter(page, 'Einkauf')
const dazwischen = await zeile('Nudeln')
notiz('nachdem Spaghetti aus dem Plan ist', dazwischen)
pruefe(
  'ohne Gericht steht gar keine Nudelzeile mehr da',
  dazwischen === null,
  dazwischen,
)

// === Der Fall: ein neues Nudelgericht ======================================
await einplanen(page, 'Nudelauflauf')
await zumReiter(page, 'Einkauf')

const danach = await zeile('Nudeln')
notiz('nachdem der Auflauf eingeplant wurde', danach)

pruefe('die Nudeln stehen wieder oben, offen', danach?.offen === true, danach)
pruefe('und sind nicht mehr abgehakt', danach?.abgehakt === false, danach)
pruefe(
  'mit der vollen Menge — abgezogen wird nichts, das alte Gericht ist weg',
  danach?.menge === '500 g' && !/noch /.test(danach?.text ?? ''),
  danach,
)
pruefe(
  'und ohne Rückfrage — hier ist nichts zweideutig',
  !(await page.locator('body').innerText()).includes('wieder auf die Liste?'),
)

await page.screenshot({
  path: new URL('107-nachgeplant.png', import.meta.url).pathname,
})

await browser.close()
schluss()
