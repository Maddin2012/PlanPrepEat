/**
 * Der goldene Rahmen um heute im Essensplan.
 *
 * Diese Probe gab es schon einmal und sie meldete grün, während der Rahmen in
 * Wirklichkeit **grau** war: Sie maß nur **leere** Felder. Ein belegtes Feld
 * trug schon einen grauen Ring, und zwei Ringfarben an einem Element schlagen
 * sich — welche gewinnt, entscheidet die Reihenfolge im Stylesheet. Martin sah
 * „bloß etwas heller".
 *
 * Deshalb misst sie jetzt **beide** Fälle, und der belegte zuerst.
 */

import {
  GOLD,
  abbruch,
  heuteLabel,
  pruefer,
  rahmenVon,
  starteApp,
  zumReiter,
} from './helfer.mjs'

const { pruefe, notiz, schluss } = pruefer()
const { browser, page } = await starteApp({ pruefe })

await zumReiter(page, 'Essensplan')

/**
 * Die beiden Felder eines Tages — gefunden über das **Datum**, nicht über eine
 * Position: Der Kalender fängt dreißig Tage in der Vergangenheit an.
 */
const felderVon = (label) =>
  page.getByRole('button', { name: new RegExp(`am .*, ${label.replace('.', '\\.')}`) })

const heute = heuteLabel()
const morgen = heuteLabel(new Date(Date.now() + 86400000))

const heutige = felderVon(heute)
pruefe('heute hat zwei Felder', (await heutige.count()) === 2, {
  tag: heute,
  gefunden: await heutige.count(),
})

// === 1 · Leere Felder von heute ==========================================
const leerHeute = await rahmenVon(heutige.first())
notiz('heute, leer', leerHeute)
pruefe('ein leeres Feld von heute ist golden umrandet',
  leerHeute.schatten.includes(GOLD), leerHeute)
pruefe('das zweite Feld von heute auch',
  (await rahmenVon(heutige.nth(1))).schatten.includes(GOLD))

const leerMorgen = await rahmenVon(felderVon(morgen).first())
notiz('morgen, leer', leerMorgen)
pruefe('ein anderer Tag ist nicht golden',
  !leerMorgen.schatten.includes(GOLD), leerMorgen)
pruefe('und behält die gestrichelte Linie',
  leerMorgen.randArt === 'dashed', leerMorgen.randArt)

// === 2 · Der Fall, an dem Paket L gescheitert ist ========================
/** Etwas eintragen — ein freier Eintrag genügt und braucht kein Rezept. */
async function eintragen(feld, text) {
  await feld.click()
  await page.waitForTimeout(600)
  await page.locator('#freier-eintrag').fill(text)
  await page.getByRole('button', { name: 'Fertig' }).click()
  await page.waitForTimeout(800)
  await abbruch(page)
}

await eintragen(heutige.first(), 'Auflauf')

const belegtHeute = await rahmenVon(heutige.first())
notiz('heute, belegt', belegtHeute)
pruefe('auch ein BELEGTES Feld von heute ist golden umrandet',
  belegtHeute.schatten.includes(GOLD), belegtHeute)
pruefe('das leere Feld daneben bleibt golden',
  (await rahmenVon(heutige.nth(1))).schatten.includes(GOLD))

// Die Reparatur darf nicht einfach überall Gold streuen.
const morgenFelder = felderVon(morgen)
await eintragen(morgenFelder.first(), 'Nudeln')
const belegtMorgen = await rahmenVon(morgenFelder.first())
notiz('morgen, belegt', belegtMorgen)
pruefe('ein belegtes Feld an einem anderen Tag bleibt grau',
  !belegtMorgen.schatten.includes(GOLD) && belegtMorgen.schatten !== 'none',
  belegtMorgen)

await page.screenshot({ path: new URL('92-heute.png', import.meta.url).pathname })

// === 3 · Der freie Eintrag braucht nur eine Bestätigung =================
/**
 * Vorher kostete er zwei: erst das **+** neben dem Feld, dann unten
 * **Fertig**. Wer nur eines von beiden drückte, stand ohne Eintrag da.
 */
pruefe('„Fertig" allein legt den Eintrag an',
  (await page.locator('main').innerText()).includes('Auflauf'))

const vorher = await page.locator('main').innerText()
await heutige.first().click()
await page.waitForTimeout(600)
await page.getByRole('button', { name: 'Fertig' }).click()
await page.waitForTimeout(700)
pruefe('ein leeres Feld legt nichts an',
  (await page.locator('main').innerText()) === vorher)

// Der alte Weg über das + geht weiter.
await heutige.first().click()
await page.waitForTimeout(600)
await page.locator('#freier-eintrag').fill('Reste')
await page.locator('form').getByRole('button').last().click()
await page.waitForTimeout(700)
const blatt = await page.getByRole('dialog').innerText()
pruefe('das + legt weiterhin an', blatt.includes('Reste'), blatt.slice(0, 200))
pruefe('und leert das Feld danach',
  (await page.locator('#freier-eintrag').inputValue()) === '')

await page.getByRole('button', { name: 'Fertig' }).click()
await page.waitForTimeout(700)
await abbruch(page)
const plan = await page.locator('main').innerText()
pruefe('beide Einträge stehen im Plan',
  plan.includes('Auflauf') && plan.includes('Reste'), plan.slice(0, 250))
pruefe('und „Reste" nur einmal', plan.split('Reste').length - 1 === 1)

await browser.close()
schluss()
