/**
 * Der Rückgängig-Knopf auf der Einkaufsliste.
 *
 * Martins Wunsch: „falls ich mal versehentlich was abgehakt habe." Geprüft
 * wird der ganze Weg — und besonders die Entscheidung, die er getroffen hat:
 * Der Knopf muss einen Reiterwechsel überstehen.
 */

import { abbruch, einplanen, pruefer, rezept, starteApp, zumReiter } from './helfer.mjs'

const { pruefe, notiz, schluss } = pruefer()
const { browser, page } = await starteApp({ pruefe })

const knopf = () => page.getByRole('button', { name: /^Rückgängig/ })
const haupt = () => page.locator('main').innerText()
const zurListe = () => zumReiter(page, 'Einkauf')

/** Steht der Posten im offenen Teil — also nicht unter „Erledigt"? */
async function istOffen(name) {
  return page.evaluate((gesucht) => {
    const abschnitte = [...document.querySelectorAll('main section')]
    const unten = abschnitte.filter((s) =>
      s.textContent.includes('Erledigt ('))
    const obenText = [...document.querySelectorAll('main')]
      .map((m) => m.textContent)
      .join(' ')
    const untenText = unten.map((s) => s.textContent).join(' ')
    return obenText.includes(gesucht) && !untenText.includes(gesucht)
  }, name)
}

await rezept(page, 'Bratkartoffeln', {
  zutaten: [
    { name: 'Kartoffeln', menge: 500, einheit: 'g' },
    { name: 'Speck', menge: 200, einheit: 'g' },
  ],
})
await einplanen(page, 'Bratkartoffeln')
await zurListe()

// === 1 · Ohne Handlung kein Knopf ========================================
pruefe('ohne Handlung steht kein Rückgängig da', (await knopf().count()) === 0)

// === 2 · Abhaken ========================================================
await page.getByRole('button', { name: /Kartoffeln abhaken|^Kartoffeln$/ }).first().click()
await page.waitForTimeout(800)
await abbruch(page)
pruefe('nach dem Abhaken steht Kartoffeln unter Erledigt',
  !(await istOffen('Kartoffeln')))
pruefe('und der Rückgängig-Knopf ist da', (await knopf().count()) === 1)
pruefe('der Knopf sagt der Vorlesehilfe, was er zurücknimmt',
  (await knopf().getAttribute('aria-label'))?.includes('Kartoffeln abgehakt'),
  await knopf().getAttribute('aria-label'))

await page.screenshot({ path: new URL('101-rueckgaengig.png', import.meta.url).pathname })

// === 3 · Zurücknehmen ===================================================
await knopf().click()
await page.waitForTimeout(900)
await abbruch(page)
pruefe('Rückgängig macht das Häkchen weg', await istOffen('Kartoffeln'))
pruefe('die Meldung nennt, was zurückgenommen wurde',
  (await haupt()).includes('Rückgängig: Kartoffeln abgehakt'),
  (await haupt()).slice(-120))

// === 4 · Leerer Stapel ==================================================
pruefe('danach ist der Knopf weg — es gibt nichts mehr zurückzunehmen',
  (await knopf().count()) === 0)

// === 5 · Mehrere Schritte ===============================================
await page.getByRole('button', { name: /Kartoffeln abhaken|^Kartoffeln$/ }).first().click()
await page.waitForTimeout(600)
await page.getByRole('button', { name: /Speck abhaken|^Speck$/ }).first().click()
await page.waitForTimeout(700)
pruefe('beide sind abgehakt',
  !(await istOffen('Kartoffeln')) && !(await istOffen('Speck')))

await knopf().click()
await page.waitForTimeout(800)
pruefe('ein Tipp nimmt nur den letzten Schritt zurück',
  (await istOffen('Speck')) && !(await istOffen('Kartoffeln')))
await knopf().click()
await page.waitForTimeout(800)
pruefe('der zweite Tipp auch den davor', await istOffen('Kartoffeln'))
pruefe('und dann ist der Stapel leer', (await knopf().count()) === 0)

// === 6 · Eine korrigierte Menge zurücknehmen ============================
/*
 * Hier stand früher das Streichen. Seit es das nicht mehr gibt, prüft dieser
 * Abschnitt die andere Änderung, die über das Blatt läuft: die Menge von Hand.
 */
await page.getByRole('button', { name: 'Kartoffeln bearbeiten' }).click()
await page.waitForTimeout(600)
// 777 statt einer runden Zahl: Die Liste rechnet Gramm ab 1000 in Kilo um,
// „1234" stünde dort als „1,23 kg" und die Prüfung ginge aus dem falschen
// Grund schief.
await page.getByLabel('Menge').fill('777')
await page.getByRole('button', { name: 'Übernehmen' }).click()
await page.waitForTimeout(900)
await abbruch(page)
pruefe('die Menge steht von Hand auf 777 g', (await haupt()).includes('777 g'))
await knopf().click()
await page.waitForTimeout(900)
await abbruch(page)
pruefe('Rückgängig nimmt die Mengenänderung zurück',
  !(await haupt()).includes('777 g'))
pruefe('und Kartoffeln stehen weiter offen da', await istOffen('Kartoffeln'))

// === 7 · Eigenen Posten löschen und zurückholen =========================
await page.getByRole('button', { name: /Listeneintrag/ }).click()
await page.waitForTimeout(300)
await page.getByRole('textbox').last().fill('Klopapier')
await page.keyboard.press('Enter')
await page.waitForTimeout(900)
pruefe('der eigene Posten steht da', (await haupt()).includes('Klopapier'))

await page.getByRole('button', { name: 'Klopapier bearbeiten' }).click()
await page.waitForTimeout(600)
await page.getByRole('button', { name: 'Posten löschen' }).click()
await page.waitForTimeout(900)
pruefe('gelöscht ist er weg', !(await haupt()).includes('Klopapier'))
await knopf().click()
await page.waitForTimeout(900)
await abbruch(page)
pruefe('Rückgängig holt einen gelöschten eigenen Posten zurück',
  (await haupt()).includes('Klopapier'), (await haupt()).slice(0, 220))

// === 8 · Der Reiterwechsel — Martins Entscheidung =======================
await page.getByRole('button', { name: /Speck abhaken|^Speck$/ }).first().click()
await page.waitForTimeout(700)
pruefe('abgehakt, Knopf da', (await knopf().count()) === 1)

await page.getByRole('link', { name: 'Rezepte' }).click()
await page.waitForTimeout(600)
await page.getByRole('link', { name: 'Essensplan' }).click()
await page.waitForTimeout(600)
await zurListe()

pruefe('nach dem Reiterwechsel steht der Knopf noch da',
  (await knopf().count()) === 1)
await knopf().click()
await page.waitForTimeout(900)
await abbruch(page)
pruefe('und er wirkt auch dann noch', await istOffen('Speck'))

// === 9 · Die Kopfzeile darf nicht überlaufen ============================
/**
 * Gemessen, nicht nach Augenmaß: Bei 390 px stehen in der Zeile jetzt drei
 * Dinge — die Zählung, Rückgängig und „Erledigte ausblenden".
 */
await page.getByRole('button', { name: /Kartoffeln abhaken|^Kartoffeln$/ }).first().click()
await page.waitForTimeout(700)
const masse = await page.evaluate(() => {
  const kopf = document.querySelector('header')
  return {
    kopf: { scroll: kopf.scrollWidth, sicht: kopf.clientWidth },
    seite: {
      scroll: document.documentElement.scrollWidth,
      sicht: document.documentElement.clientWidth,
    },
  }
})
notiz('Kopfzeile', masse)
pruefe('die Kopfzeile läuft nicht über',
  masse.kopf.scroll <= masse.kopf.sicht, masse.kopf)
pruefe('und die Seite scrollt nicht waagerecht',
  masse.seite.scroll <= masse.seite.sicht, masse.seite)
pruefe('alle drei Dinge stehen noch in der Zeile',
  (await page.locator('header').innerText()).includes('Rückgängig') &&
  (await page.locator('header').innerText()).includes('Erledigte ausblenden') &&
  (await page.locator('header').innerText()).includes('offen'),
  await page.locator('header').innerText())

await page.screenshot({ path: new URL('102-kopfzeile.png', import.meta.url).pathname })

await browser.close()
schluss()
