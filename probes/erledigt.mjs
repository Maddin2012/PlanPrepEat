/**
 * Die abgehakten Posten stehen alphabetisch.
 *
 * Martins Wunsch. Oben gilt weiter die **Ladenreihenfolge** — die Runde durch
 * den Laden —, unten im Wagen sucht man nach dem Namen.
 *
 * **Ohne eine von Hand geschobene Runde wäre hier nichts zu beweisen:** Bei
 * leerer Runde sortierte schon die alte Fassung alphabetisch. Deshalb wird
 * zuerst eine erzeugt, die dem Alphabet widerspricht.
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

/** Die Namen im offenen Teil, von oben nach unten. */
const offeneNamen = () =>
  page.evaluate(() => {
    const abschnitte = [...document.querySelectorAll('main section')]
    const unten = abschnitte.filter(
      (s) =>
        s.textContent.includes('Erledigt (') ||
        s.textContent.includes('Brauche ich diese Woche nicht'),
    )
    const haupt = document.querySelector('main')
    return [...haupt.querySelectorAll('button[aria-label$=" bearbeiten"]')]
      .filter((b) => !unten.some((s) => s.contains(b)))
      .map((b) => b.getAttribute('aria-label').replace(' bearbeiten', ''))
  })

/** Die Namen im Erledigt-Block, von oben nach unten. */
const erledigteNamen = () =>
  page.evaluate(() => {
    const block = [...document.querySelectorAll('main section')].find((s) =>
      s.textContent.includes('Erledigt ('),
    )
    if (!block) return []
    return [...block.querySelectorAll('button[aria-label$=" bearbeiten"]')].map(
      (b) => b.getAttribute('aria-label').replace(' bearbeiten', ''),
    )
  })

/**
 * Das Häkchen umschalten.
 *
 * Der Knopf dafür trägt **keine** eigene Beschriftung — sein Name kommt aus
 * dem Text der Zeile, also Name *und* Menge. Erkennbar ist er an
 * `aria-pressed`; der Knopf daneben („… bearbeiten") hat das nicht. Über den
 * Namen allein wäre es zweideutig.
 */
const umhaken = async (name) => {
  await page
    .locator('button[aria-pressed]')
    .filter({ hasText: name })
    .first()
    .click()
  await page.waitForTimeout(700)
}
const abhaken = umhaken
const aufhaken = umhaken

/**
 * Einen Posten am Anfasser nach oben ziehen.
 *
 * Der Sensor löst erst nach 5 px aus, deshalb zwei Bewegungen — und am Ende
 * eine kurze Pause, damit dnd-kit die neue Reihenfolge schreiben kann.
 */
async function ziehen(name, nachOben = 2) {
  const griff = page.getByRole('button', { name: `${name} verschieben` })
  const kasten = await griff.boundingBox()
  const x = kasten.x + kasten.width / 2
  const y = kasten.y + kasten.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y - 10)
  for (let schritt = 1; schritt <= 6; schritt += 1) {
    await page.mouse.move(x, y - 10 - (nachOben * 68 * schritt) / 6)
    await page.waitForTimeout(25)
  }
  await page.mouse.up()
  await page.waitForTimeout(900)
  await abbruch(page)
}

// === Aufbau ===============================================================
/** Alphabetisch wären es Apfel, Mehl, Zucker. */
await rezept(page, 'Kuchen', {
  zutaten: [
    { name: 'Apfel', menge: 3, einheit: 'stk' },
    { name: 'Zucker', menge: 200, einheit: 'g' },
    { name: 'Mehl', menge: 400, einheit: 'g' },
  ],
})
await einplanen(page, 'Kuchen')
await zumReiter(page, 'Einkauf')

notiz('offen am Anfang', await offeneNamen())
pruefe('ohne Runde steht die Liste alphabetisch',
  JSON.stringify(await offeneNamen()) === JSON.stringify(['Apfel', 'Mehl', 'Zucker']),
  await offeneNamen())

// === 1 · Eine Runde erzeugen, die dem Alphabet widerspricht ==============
await ziehen('Zucker', 2)
const nachZiehen = await offeneNamen()
notiz('offen nach dem Ziehen', nachZiehen)
pruefe('Zucker steht nach dem Ziehen vorn — die Runde gilt',
  nachZiehen[0] === 'Zucker', nachZiehen)

// === 2 · Martins Wunsch ==================================================
await abhaken('Apfel')
await abhaken('Zucker')
await abhaken('Mehl')
await abbruch(page)

const erledigt = await erledigteNamen()
notiz('Erledigt-Block', erledigt)
pruefe('die abgehakten Posten stehen alphabetisch',
  JSON.stringify(erledigt) === JSON.stringify(['Apfel', 'Mehl', 'Zucker']),
  erledigt)

await page.screenshot({ path: new URL('104-erledigt.png', import.meta.url).pathname })

// === 3 · Die Runde bleibt gemerkt ========================================
/** Häkchen zurück: Zucker muss wieder vorn stehen, nicht alphabetisch. */
await aufhaken('Apfel')
await aufhaken('Zucker')
await aufhaken('Mehl')
await abbruch(page)
const wiederOffen = await offeneNamen()
notiz('offen nach dem Aufhaken', wiederOffen)
pruefe('nach dem Aufhaken gilt wieder die Runde, nicht das Alphabet',
  wiederOffen[0] === 'Zucker', wiederOffen)

// === 4 · Die Nebenwirkung ================================================
/**
 * Hier geht es um das, was Martin **nicht** sieht: `move` schreibt die
 * sichtbare Reihenfolge in die gemerkte Runde fort. Stehen die Abgehakten
 * alphabetisch da und fließen so ein, überschreibt ein Verschieben oben die
 * gemerkten Plätze von allem, was im Wagen liegt.
 */
await abhaken('Zucker')
// Jetzt oben schieben, während Zucker abgehakt ist.
await ziehen('Mehl', 1)
notiz('offen nach dem Schieben mit abgehaktem Zucker', await offeneNamen())

await aufhaken('Zucker')
await abbruch(page)
const danach = await offeneNamen()
notiz('offen, nachdem Zucker zurückkam', danach)
pruefe('der gemerkte Platz von Zucker hat das Schieben überlebt',
  danach[0] === 'Zucker', danach)

await browser.close()
schluss()
