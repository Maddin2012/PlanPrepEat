/**
 * Mehr nötig als beim Abhaken — Martins Fall vom 25.10.
 *
 * Der Wocheneinkauf war fertig und abgehakt. Dann kam ein weiteres One Pot
 * Pasta in den Plan. Die Nudelmenge wuchs, das Häkchen blieb, und die Zeile lag
 * weiter unten im **Erledigt**-Block — dort sieht niemand nach, wenn der
 * Einkauf als erledigt gilt. Die Zutaten „standen nicht auf der Liste".
 *
 * Geprüft wird deshalb nicht nur die Zahl, sondern **wo die Zeile steht**.
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

/**
 * Eine Zeile der Einkaufsliste ausmessen.
 *
 * `offen` kommt aus der Stellung im Baum, nicht aus dem Häkchen: Genau das war
 * der Fehler — die Zeile war abgehakt *und* lag unten, obwohl mehr nötig war.
 */
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
        reihe.querySelector('button[aria-pressed]')?.getAttribute('aria-pressed') ===
        'true',
      offen: !erledigt,
    }
  }, name)

const umhaken = async (name) => {
  await page.locator('button[aria-pressed]').filter({ hasText: name }).first().click()
  await page.waitForTimeout(700)
}

// === Aufbau: zwei Mal One Pot Pasta, Einkauf erledigt ====================
await rezept(page, 'One Pot Pasta', {
  zutaten: [{ name: 'Nudeln', menge: 500, einheit: 'g' }],
})
await einplanen(page, 'One Pot Pasta')
await einplanen(page, 'One Pot Pasta')
await zumReiter(page, 'Einkauf')

const vorher = await zeile('Nudeln')
notiz('nach zwei Rezepten', vorher)
pruefe('zwei Mal eingeplant ergibt die doppelte Menge',
  vorher?.menge === '1 kg' || vorher?.menge === '1000 g', vorher)

await umhaken('Nudeln')
await abbruch(page)
const abgehakt = await zeile('Nudeln')
notiz('nach dem Abhaken', abgehakt)
pruefe('abgehakt rutscht die Zeile in den Erledigt-Block',
  abgehakt?.abgehakt === true && abgehakt?.offen === false, abgehakt)

// === Der Fall: ein drittes Mal einplanen =================================
await einplanen(page, 'One Pot Pasta')
await zumReiter(page, 'Einkauf')

const danach = await zeile('Nudeln')
notiz('nachdem ein drittes Rezept dazukam', danach)

pruefe('die Zeile steht wieder oben bei den offenen Posten',
  danach?.offen === true, danach)
pruefe('und ist nicht mehr abgehakt',
  danach?.abgehakt === false, danach)
pruefe('die Gesamtmenge ist gewachsen',
  danach?.menge === '1,5 kg' || danach?.menge === '1500 g', danach)
pruefe('und die Zeile sagt, wie viel noch fehlt',
  /noch 500 g/.test(danach?.text ?? ''), danach?.text)

await page.screenshot({ path: new URL('105-nachschlag.png', import.meta.url).pathname })

// === Gegenprobe im Betrieb: wieder abhaken, nichts ändern ================
await umhaken('Nudeln')
await abbruch(page)
const erneut = await zeile('Nudeln')
notiz('nach dem erneuten Abhaken', erneut)
pruefe('erneut abgehakt bleibt es auch — der Hinweis ist weg',
  erneut?.abgehakt === true && !/noch /.test(erneut?.text ?? ''), erneut)

await browser.close()
schluss()
