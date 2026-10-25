/**
 * Das Streichen ist weg.
 *
 * Martin: *„Die Funktion ‚Brauche ich die Woche nicht' kann weg."* Eine
 * Rezeptzutat, die man nicht braucht, hakt man ab — den Weg, sie aus der Liste
 * zu nehmen, gibt es nicht mehr.
 *
 * Geprüft wird **beides**: dass der Weg fehlt, und dass daneben nichts
 * kaputtgegangen ist. Ein eigener Posten muss sich weiter löschen lassen, und
 * das Blatt einer Rezeptzutat muss seine eigentliche Aufgabe behalten — die
 * Menge ändern.
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

const haupt = () => page.locator('body').innerText()

/** Das Blatt zu einem Posten öffnen. */
const insBlatt = async (name) => {
  await page.getByRole('button', { name: `${name} bearbeiten` }).click()
  await page.waitForTimeout(600)
}
const blattZu = async () => {
  await page.getByRole('button', { name: 'Abbrechen' }).click()
  await page.waitForTimeout(500)
  await abbruch(page)
}

// === Aufbau ==============================================================
await rezept(page, 'Suppe', {
  zutaten: [{ name: 'Zwiebeln', menge: 200, einheit: 'g' }],
})
await einplanen(page, 'Suppe')
await zumReiter(page, 'Einkauf')

// === 1 · Der Knopf ist fort ==============================================
await insBlatt('Zwiebeln')
const blatt = await haupt()
notiz('Blatt einer Rezeptzutat', blatt.replace(/\s+/g, ' ').slice(0, 220))

pruefe('im Blatt steht kein „Brauche ich diese Woche nicht" mehr',
  !blatt.includes('Brauche ich'))
pruefe('und auch kein Löschen für eine Rezeptzutat',
  !blatt.includes('Posten löschen'))
pruefe('die Menge lässt sich dort weiter ändern',
  (await page.getByLabel('Menge').count()) === 1)

// === 2 · Das Blatt tut noch, wofür es da ist =============================
await page.getByLabel('Menge').fill('333')
await page.getByRole('button', { name: 'Übernehmen' }).click()
await page.waitForTimeout(900)
await abbruch(page)
pruefe('die geänderte Menge kommt an', (await haupt()).includes('333 g'))

// === 3 · Kein unterer Block mehr =========================================
pruefe('es gibt nirgends einen Block „Brauche ich diese Woche nicht"',
  !(await haupt()).includes('Brauche ich'))

// === 4 · Abhaken ist der Weg =============================================
await page.locator('button[aria-pressed]').filter({ hasText: 'Zwiebeln' }).first().click()
await page.waitForTimeout(800)
await abbruch(page)
const nachHaken = await haupt()
notiz('nach dem Abhaken', nachHaken.replace(/\s+/g, ' ').slice(0, 160))
// Die Überschrift steht im Stil auf Großbuchstaben; `innerText` liefert sie
// deshalb als „ERLEDIGT (1)" — nicht so, wie sie im Quelltext steht.
pruefe('abgehakt landet die Zutat unter „Erledigt"',
  /erledigt \(1\)/i.test(nachHaken))

// === 5 · Eigene Posten bleiben löschbar ==================================
await page.getByRole('button', { name: /Listeneintrag/ }).click()
await page.waitForTimeout(300)
await page.getByRole('textbox').last().fill('Klopapier')
await page.keyboard.press('Enter')
await page.waitForTimeout(900)
await abbruch(page)
pruefe('der eigene Posten steht da', (await haupt()).includes('Klopapier'))

await insBlatt('Klopapier')
pruefe('sein Blatt bietet weiterhin „Posten löschen"',
  (await haupt()).includes('Posten löschen'))
await page.getByRole('button', { name: 'Posten löschen' }).click()
await page.waitForTimeout(900)
await abbruch(page)
pruefe('und damit ist er weg', !(await haupt()).includes('Klopapier'))

await page.screenshot({ path: new URL('106-ohne-streichen.png', import.meta.url).pathname })

await browser.close()
schluss()
