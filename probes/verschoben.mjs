/**
 * Verschobenes Gericht: Die App fragt, statt zu raten.
 *
 * „Verschoben" und „gegessen, dann neu eingeplant" sehen in den Daten gleich
 * aus — der Eintrag ist am alten Platz weg und am neuen da. Im ersten Fall
 * liegen die Zutaten noch im Schrank, im zweiten sind sie aufgebraucht. Martins
 * Vorschlag: nicht raten, nachfragen.
 *
 * Geprüft wird beides: dass gefragt wird, **und** dass jede der beiden
 * Antworten hält, was sie verspricht — besonders, dass „Nein" die Frage
 * endgültig beantwortet und nicht beim nächsten Blick wiederkommt.
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

const zeile = (name) =>
  page.evaluate((gesucht) => {
    const knopf = [
      ...document.querySelectorAll('main button[aria-label$=" bearbeiten"]'),
    ].find((b) => b.getAttribute('aria-label') === `${gesucht} bearbeiten`)
    if (!knopf) return null
    const erledigt = [...document.querySelectorAll('main section')].some(
      (s) => s.textContent.includes('Erledigt (') && s.contains(knopf),
    )
    return { offen: !erledigt }
  }, name)

const umhaken = async (name) => {
  await page
    .locator('button[aria-pressed]')
    .filter({ hasText: name })
    .first()
    .click()
  await page.waitForTimeout(700)
}

async function vomPlanNehmen(name, mahlzeit) {
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

/**
 * Dasselbe Gericht von der einen Mahlzeit auf die andere bringen.
 *
 * Beide Richtungen, weil zweimal verschoben wird: Nach dem ersten Zug liegt
 * das Gericht beim Abendbrot und muss von dort zurückgeholt werden.
 */
async function verschieben(name, von = 'Mittagessen', nach = 'Abendbrot') {
  await vomPlanNehmen(name, von)
  await einplanen(page, name, nach)
}

// === Aufbau: einplanen, einkaufen, abhaken ================================
await rezept(page, 'Spaghetti', {
  zutaten: [
    { name: 'Nudeln', menge: 500, einheit: 'g' },
    { name: 'Tomaten', menge: 400, einheit: 'g' },
  ],
})
await einplanen(page, 'Spaghetti')
await zumReiter(page, 'Einkauf')
await umhaken('Nudeln')
await umhaken('Tomaten')
await abbruch(page)
pruefe(
  'beide Zutaten sind abgehakt',
  (await zeile('Nudeln'))?.offen === false &&
    (await zeile('Tomaten'))?.offen === false,
)

// === 1 · Verschieben erzeugt die Rückfrage ================================
await verschieben('Spaghetti')
await zumReiter(page, 'Einkauf')

const band = await haupt()
notiz('Band nach dem Verschieben', band.replace(/\s+/g, ' ').slice(0, 200))
pruefe('es wird nachgefragt', band.includes('wieder auf die Liste?'), band.slice(0, 120))
pruefe('die Frage nennt das Gericht', band.includes('Spaghetti'))
pruefe('und beide Tage', /Abendbrot/.test(band) && /Mittagessen/.test(band))
pruefe(
  'die Häkchen bleiben, solange nicht geantwortet ist',
  (await zeile('Nudeln'))?.offen === false,
)

await page.screenshot({
  path: new URL('108-verschoben.png', import.meta.url).pathname,
})

// === 2 · „Nein" beantwortet die Frage endgültig ============================
await page.getByRole('button', { name: 'Nein, hab ich noch' }).click()
await page.waitForTimeout(900)
await abbruch(page)
pruefe(
  'nach „Nein" ist das Band weg',
  !(await haupt()).includes('wieder auf die Liste?'),
)
pruefe(
  'und die Zutaten bleiben abgehakt',
  (await zeile('Nudeln'))?.offen === false,
)

// **Der eigentliche Punkt:** Die Frage darf nicht wiederkommen. Sie entsteht
// aus dem Unterschied zwischen gemerktem und heutigem Stand — „Nein" muss
// diesen Unterschied aus der Welt schaffen, nicht nur das Band ausblenden.
await zumReiter(page, 'Rezepte')
await zumReiter(page, 'Einkauf')
pruefe(
  'und sie kommt nach einem Reiterwechsel nicht wieder',
  !(await haupt()).includes('wieder auf die Liste?'),
)

// === 3 · „Ja" holt die Zutaten zurück =====================================
await verschieben('Spaghetti', 'Abendbrot', 'Mittagessen')
await zumReiter(page, 'Einkauf')
pruefe(
  'ein zweites Verschieben fragt erneut',
  (await haupt()).includes('wieder auf die Liste?'),
)

await page.getByRole('button', { name: 'Ja, wieder drauf' }).click()
await page.waitForTimeout(900)
await abbruch(page)
const nachJa = {
  nudeln: await zeile('Nudeln'),
  tomaten: await zeile('Tomaten'),
}
notiz('nach „Ja"', nachJa)
pruefe(
  'nach „Ja" stehen beide Zutaten wieder offen oben',
  nachJa.nudeln?.offen === true && nachJa.tomaten?.offen === true,
  nachJa,
)
pruefe('und das Band ist weg', !(await haupt()).includes('wieder auf die Liste?'))

await browser.close()
schluss()
