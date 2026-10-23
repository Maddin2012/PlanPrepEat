/**
 * Gestrichene Zutaten.
 *
 * Martins Meldung: „Wenn ich ein Rezept nehme, wo Kartoffeln und Zwiebeln drin
 * sind, überträgt er die Zutaten nicht in die Einkaufsliste." Ursache war ein
 * Tipp auf „Brauche ich nicht" — der sperrte die Zutat dauerhaft, in jedem
 * Rezept, unsichtbar und ohne Weg zurück.
 *
 * Geprüft wird hier der **sichtbare** Weg. Das Verfallen nach einer Woche
 * prüfen die Einheitentests: Dort ist „heute" ein Parameter, hier müsste man
 * den gespeicherten Stand von außen fälschen — die unzuverlässigere Prüfung
 * für dieselbe Aussage.
 */

import { abbruch, einplanen, pruefer, rezept, starteApp, zumReiter } from './helfer.mjs'

const { pruefe, schluss } = pruefer()
const { browser, page } = await starteApp({ pruefe })

const gestrichenerBlock = () =>
  page.locator('section', { hasText: 'Brauche ich diese Woche nicht' }).first()
const haupt = () => page.locator('main').innerText()
const zurListe = () => zumReiter(page, 'Einkauf')

// === Aufbau: ein Rezept mit Kartoffeln und einer zweiten Zutat ============
await rezept(page, 'Bratkartoffeln', {
  zutaten: [
    { name: 'Kartoffeln', menge: 500, einheit: 'g' },
    { name: 'Speck', menge: 200, einheit: 'g' },
  ],
})
await einplanen(page, 'Bratkartoffeln')

const text = await zurListe()
pruefe('beide Zutaten stehen auf der Liste',
  text.includes('Kartoffeln') && text.includes('Speck'), text.slice(0, 300))

// === 1 · Streichen ========================================================
await page.getByRole('button', { name: 'Kartoffeln bearbeiten' }).click()
await page.waitForTimeout(600)
await page.getByRole('button', { name: 'Brauche ich diese Woche nicht' }).click()
await page.waitForTimeout(800)
await abbruch(page)

pruefe('„Speck" steht unverändert auf der Liste',
  (await haupt()).includes('Speck'), (await haupt()).slice(0, 300))

// === 2 · Der Block — die Prüfung, die es vorher nicht gab =================
const block = gestrichenerBlock()
pruefe('es gibt einen Block „Brauche ich diese Woche nicht"',
  (await block.count()) === 1)
pruefe('und „Kartoffeln" steht sichtbar darin',
  (await block.innerText()).includes('Kartoffeln'),
  await block.innerText().catch(() => '(kein Block)'))
pruefe('der Block sagt, dass es nach einer Woche von selbst zurückkommt',
  (await block.innerText()).includes('einer Woche'))

await page.screenshot({ path: new URL('100-gestrichen.png', import.meta.url).pathname })

// --- Kartoffeln stehen nicht mehr im oberen Teil -------------------------
const obenOhne = await page.evaluate(() => {
  const abschnitte = [...document.querySelectorAll('main section')]
  const gestrichen = abschnitte.find((s) =>
    s.textContent.includes('Brauche ich diese Woche nicht'))
  return abschnitte
    .filter((s) => s !== gestrichen)
    .map((s) => s.textContent)
    .join(' | ')
})
pruefe('oben auf der Liste stehen die Kartoffeln nicht mehr',
  !obenOhne.includes('Kartoffeln'), obenOhne.slice(0, 250))

// === 3 · Zurückholen ======================================================
await block.getByRole('button', { name: /Kartoffeln|Zurück auf die Liste/ }).first().click()
await page.waitForTimeout(900)
await abbruch(page)

const zurueck = await haupt()
pruefe('ein Tipp holt die Kartoffeln zurück auf die Liste',
  zurueck.includes('Kartoffeln'), zurueck.slice(0, 300))
pruefe('und der gestrichene Block ist wieder weg',
  (await gestrichenerBlock().count()) === 0)
pruefe('„Speck" ist über alles hinweg unberührt', zurueck.includes('Speck'))

// === 4 · Ein zweites Rezept mit derselben Zutat ==========================
/**
 * Der Kern von Martins Fehler: Eine Zutat wird über ihren **Namen** gefunden,
 * eine Streichung wirkte deshalb auch in einem Rezept, das es beim Streichen
 * noch nicht gab. Jetzt ist sie in dem Fall wenigstens sichtbar.
 */
await page.getByRole('button', { name: 'Kartoffeln bearbeiten' }).click()
await page.waitForTimeout(600)
await page.getByRole('button', { name: 'Brauche ich diese Woche nicht' }).click()
await page.waitForTimeout(800)

await rezept(page, 'Kartoffelsalat', {
  zutaten: [
    { name: 'Kartoffeln', menge: 800, einheit: 'g' },
    { name: 'Schnittlauch', menge: 1, einheit: 'bund' },
  ],
})
await einplanen(page, 'Kartoffelsalat')
await zurListe()

const mitZweitem = await haupt()
pruefe('die neue Zutat des zweiten Rezepts kommt an',
  mitZweitem.includes('Schnittlauch'), mitZweitem.slice(0, 350))
pruefe('die Kartoffeln fehlen nicht lautlos, sondern stehen im Block',
  (await gestrichenerBlock().count()) === 1 &&
  (await gestrichenerBlock().innerText()).includes('Kartoffeln'),
  mitZweitem.slice(0, 350))

// === 5 · Von Hand eintippen, was gestrichen ist ==========================
// Statt eines zweiten „Kartoffeln" daneben wird die Streichung aufgehoben.
await page.getByRole('button', { name: /Listeneintrag/ }).click()
await page.waitForTimeout(300)
await page.getByRole('textbox').last().fill('Kartoffeln')
await page.keyboard.press('Enter')
await page.waitForTimeout(900)
await abbruch(page)

const nachTippen = await haupt()
pruefe('ein von Hand getipptes „Kartoffeln" hebt die Streichung auf',
  (await gestrichenerBlock().count()) === 0 && nachTippen.includes('Kartoffeln'),
  nachTippen.slice(0, 300))
/**
 * Gezählt werden **Zeilen**, nicht Textstellen: Die Quellenzeile nennt die
 * Rezepte, und in „Bratkartoffeln" steckt „Kartoffeln" mit drin. Eine Textsuche
 * über die Seite käme deshalb auf zwei und wäre falsch rot.
 */
const zeilen = await page.getByRole('button', { name: 'Kartoffeln bearbeiten' }).count()
pruefe('und „Kartoffeln" steht nur in einer Zeile', zeilen === 1, { zeilen })
pruefe('die Mengen beider Rezepte sind darin zusammengerechnet',
  nachTippen.includes('1,3 kg'), nachTippen.slice(0, 220))

await browser.close()
schluss()
