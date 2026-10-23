/**
 * Vorlesen und die Stimme.
 *
 * Fasst die beiden alten Proben (Vorlesen, Stimme) zusammen. Im Behälter liegt
 * keine einzige echte Stimme — eine **Attrappe** schreibt deshalb mit, was
 * gesprochen würde und mit welcher Stimme, welchem Tempo und welcher Tonhöhe.
 * Genau daran hängt die Aussage: Die Einstellungen sollen nicht nur gut
 * aussehen, sie müssen an der Sprachausgabe ankommen.
 */

import { abbruch, insRezept, pruefer, rezept, starteApp, zumReiter } from './helfer.mjs'

const { pruefe, notiz, schluss } = pruefer()

/** Die Attrappe für `speechSynthesis`, mit veränderlicher Stimmenliste. */
const attrappe = (stimmen, gemerkt) => `
window.__tts = { gesprochen: [], laufend: null }
class FakeUtterance {
  constructor(text) {
    this.text = text; this.voice = null; this.rate = 1; this.pitch = 1
    this.onend = null; this.onerror = null
  }
}
Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FakeUtterance, configurable: true })
window.__stimmen = ${JSON.stringify(stimmen)}
window.__horcher = []
Object.defineProperty(window, 'speechSynthesis', {
  configurable: true,
  value: {
    getVoices: () => window.__stimmen,
    addEventListener(art, fn) { if (art === 'voiceschanged') window.__horcher.push(fn) },
    removeEventListener(art, fn) {
      window.__horcher = window.__horcher.filter((h) => h !== fn)
    },
    cancel() { window.__tts.laufend = null },
    speak(u) {
      window.__tts.gesprochen.push({
        text: u.text,
        stimme: u.voice && u.voice.name,
        tempo: u.rate,
        hoehe: u.pitch,
      })
      window.__tts.laufend = u
    },
  },
})
/** Das Ende eines Schritts von Hand auslösen. */
window.__fertig = () => {
  const u = window.__tts.laufend
  window.__tts.laufend = null
  if (u && u.onend) u.onend()
}
/** Eine Stimme nachinstallieren, wie Android es täte. */
window.__installieren = (stimme) => {
  window.__stimmen = [...window.__stimmen, stimme]
  window.__horcher.forEach((fn) => fn())
}
${gemerkt ? `try { localStorage.setItem('planprepeat.stimme', ${JSON.stringify(JSON.stringify(gemerkt))}) } catch {}` : ''}
`

const DEUTSCH = [
  { name: 'Anna', lang: 'de-DE' },
  { name: 'Markus', lang: 'de-DE' },
  { name: 'Google Deutsch', lang: 'de-DE' },
  { name: 'Samantha', lang: 'en-US' },
]

/** Eine Sitzung mit einem Rezept, dessen zweiter Schritt voller Kürzel ist. */
async function sitzung(stimmen, gemerkt = null) {
  const { browser, page } = await starteApp({
    pruefe,
    initSkript: attrappe(stimmen, gemerkt),
  })
  await rezept(page, 'Bolognese', {
    zutaten: [{ name: 'Hackfleisch', menge: 500, einheit: 'g' }],
    schritte: [
      'Zwiebeln würfeln.',
      '2 EL Öl erhitzen und ca. 5 Min. anbraten.',
      'Bei 180 °C überbacken.',
    ],
  })
  return { browser, page }
}

const gesprochen = (page) => page.evaluate(() => window.__tts.gesprochen)
const letzte = async (page) => (await gesprochen(page)).at(-1) ?? null
const leeren = (page) => page.evaluate(() => { window.__tts.gesprochen = [] })
const fertig = async (page) => {
  await page.evaluate(() => window.__fertig())
  await page.waitForTimeout(300)
}
const aktiverSchritt = (page) =>
  page.locator('li[aria-current="step"]').innerText().catch(() => null)

/** Zum Abschnitt „Stimme fürs Vorlesen" in den Einstellungen. */
async function zumStimmenabschnitt(page) {
  const zurueck = page.getByRole('button', { name: 'Zurück' }).first()
  if (await zurueck.isVisible().catch(() => false)) {
    await zurueck.click()
    await page.waitForTimeout(600)
  }
  await page.getByRole('link', { name: 'Einstellungen' }).click()
  await page.waitForTimeout(600)
  const abschnitt = page.locator('details', { hasText: 'Stimme fürs Vorlesen' }).first()
  if ((await abschnitt.count()) > 0) {
    await abschnitt.locator('summary').first().click()
    await page.waitForTimeout(400)
  }
  return abschnitt
}

// =========================================================================
// A · Vorlesen mit deutscher Stimme
// =========================================================================
{
  const { browser, page } = await sitzung(DEUTSCH)
  await insRezept(page, 'Bolognese')

  pruefe('der Vorlese-Knopf steht da',
    await page.getByRole('button', { name: 'Vorlesen', exact: true }).isVisible())

  await page.getByRole('button', { name: 'Vorlesen', exact: true }).click()
  await page.waitForTimeout(400)
  pruefe('der erste Schritt wird gelesen',
    (await gesprochen(page)).length === 1 &&
    (await gesprochen(page))[0].text === 'Zwiebeln würfeln.',
    await letzte(page))
  pruefe('und ist hervorgehoben',
    (await aktiverSchritt(page))?.includes('Zwiebeln würfeln.'))
  pruefe('die Leiste zeigt, wo man ist',
    (await page.locator('body').innerText()).includes('Schritt 1 von 3'))

  // --- Von selbst weiter, mit ausgesprochenen Kürzeln --------------------
  await fertig(page)
  pruefe('danach kommt der zweite Schritt von selbst',
    (await gesprochen(page)).length === 2)
  pruefe('die Kürzel werden ausgeschrieben',
    (await gesprochen(page))[1].text ===
      '2 Esslöffel Öl erhitzen und circa 5 Minuten anbraten.',
    (await gesprochen(page))[1].text)
  pruefe('auf dem Bildschirm steht weiter der getippte Text',
    (await page.locator('body').innerText()).includes('2 EL Öl erhitzen'))

  // --- Anhalten und weiter ----------------------------------------------
  await page.getByRole('button', { name: 'Anhalten' }).click()
  await page.waitForTimeout(400)
  pruefe('beim Anhalten wird nichts Neues gelesen',
    (await gesprochen(page)).length === 2)
  pruefe('und die Leiste sagt es',
    (await page.locator('body').innerText()).includes('angehalten'))

  await page.getByRole('button', { name: 'Weiterlesen' }).click()
  await page.waitForTimeout(400)
  pruefe('Weiterlesen fängt denselben Schritt wieder an',
    (await gesprochen(page)).length === 3 &&
    (await gesprochen(page))[2].text === (await gesprochen(page))[1].text)

  // --- Springen ----------------------------------------------------------
  await page.getByRole('button', { name: 'Nächster Schritt' }).click()
  await page.waitForTimeout(400)
  pruefe('„Nächster Schritt" springt weiter',
    (await letzte(page)).text === 'Bei 180 Grad überbacken.',
    (await letzte(page)).text)
  pruefe('am Ende ist „Nächster Schritt" abgeschaltet',
    await page.getByRole('button', { name: 'Nächster Schritt' }).isDisabled())

  await page.getByRole('button', { name: 'Voriger Schritt' }).click()
  await page.waitForTimeout(400)
  pruefe('„Voriger Schritt" geht zurück',
    (await page.locator('body').innerText()).includes('Schritt 2 von 3'))

  // --- Am Ende hört es von selbst auf ------------------------------------
  await page.getByRole('button', { name: 'Nächster Schritt' }).click()
  await page.waitForTimeout(300)
  await fertig(page)
  pruefe('nach dem letzten Schritt ist die Leiste weg',
    !(await page.locator('body').innerText()).includes('Schritt 3 von 3'))
  pruefe('und nichts ist mehr hervorgehoben',
    (await page.locator('li[aria-current="step"]').count()) === 0)

  // --- Beim Verlassen der Seite ist Schluss -------------------------------
  await page.getByRole('button', { name: 'Vorlesen', exact: true }).click()
  await page.waitForTimeout(300)
  const vorherige = (await gesprochen(page)).length
  await page.getByRole('button', { name: 'Zurück' }).first().click()
  await page.waitForTimeout(600)
  await page.evaluate(() => window.__fertig())
  await page.waitForTimeout(300)
  pruefe('nach dem Verlassen wird nicht weitergelesen',
    (await gesprochen(page)).length === vorherige)

  await page.screenshot({ path: new URL('94-vorlesen.png', import.meta.url).pathname })
  await browser.close()
}

// =========================================================================
// B · Stimme, Tempo und Tonhöhe kommen an
// =========================================================================
{
  const { browser, page } = await sitzung(DEUTSCH)
  const abschnitt = await zumStimmenabschnitt(page)
  await abbruch(page)

  // Nur die Stimmenliste, nicht die Tempo- oder Tonhöhenstufen.
  const stimmenliste = abschnitt.getByRole('radiogroup', { name: 'Stimme' })
  const angeboten = await stimmenliste.getByRole('radio').evaluateAll((els) =>
    els.map((el) => el.textContent.trim()))
  notiz('angeboten', angeboten)
  pruefe('alle drei deutschen Stimmen stehen zur Wahl',
    ['Anna', 'Markus', 'Google Deutsch'].every((n) => angeboten.includes(n)), angeboten)
  pruefe('die englische steht nicht dabei', !angeboten.includes('Samantha'))
  pruefe('ohne eigene Wahl ist die erste eingestellt',
    (await abschnitt.getByRole('radio', { name: 'Anna' }).getAttribute('aria-checked')) === 'true')

  // --- Eine andere wählen ------------------------------------------------
  await leeren(page)
  await abschnitt.getByRole('radio', { name: 'Markus' }).click()
  await page.waitForTimeout(500)
  const probe = await letzte(page)
  pruefe('ein Tipp liest sofort einen Satz zur Probe vor',
    probe?.text?.includes('Zwiebeln') && probe?.stimme === 'Markus', probe)

  // --- Tempo und Tonhöhe -------------------------------------------------
  await leeren(page)
  await abschnitt.getByRole('radio', { name: 'Zügig' }).click()
  await page.waitForTimeout(500)
  pruefe('„Zügig" kommt als schnelleres Tempo an', (await letzte(page)).tempo > 0.95,
    await letzte(page))

  await leeren(page)
  await abschnitt.getByRole('radio', { name: 'Tief' }).click()
  await page.waitForTimeout(500)
  pruefe('„Tief" kommt als tiefere Tonhöhe an', (await letzte(page)).hoehe < 1,
    await letzte(page))

  // --- Und beim Vorlesen des Rezepts -------------------------------------
  await zumReiter(page, 'Rezepte')
  await insRezept(page, 'Bolognese')
  await leeren(page)
  await page.getByRole('button', { name: 'Vorlesen', exact: true }).click()
  await page.waitForTimeout(500)
  const gelesen = await letzte(page)
  notiz('beim Rezept', gelesen)
  pruefe('Stimme, Tempo und Tonhöhe gelten auch beim Rezept',
    gelesen.stimme === 'Markus' && gelesen.tempo > 0.95 && gelesen.hoehe < 1,
    gelesen)

  // --- Neuladen: die Wahl steht noch -------------------------------------
  await page.reload()
  await page.waitForTimeout(900)
  const nachher = await zumStimmenabschnitt(page)
  pruefe('nach dem Neuladen ist Markus noch eingestellt',
    (await nachher.getByRole('radio', { name: 'Markus' }).getAttribute('aria-checked')) === 'true')
  pruefe('und steht zugeklappt in der Kopfzeile',
    (await nachher.locator('summary').first().innerText()).includes('Markus'))

  await browser.close()
}

// =========================================================================
// C · Eine verschwundene Stimme würgt das Vorlesen nicht ab
// =========================================================================
{
  const { browser, page } = await sitzung(DEUTSCH, { name: 'Petra', tempo: 'normal' })
  await insRezept(page, 'Bolognese')
  await leeren(page)
  await page.getByRole('button', { name: 'Vorlesen', exact: true }).click()
  await page.waitForTimeout(500)
  pruefe('eine verschwundene Stimme wird durch die erste ersetzt',
    (await letzte(page)).stimme === 'Anna', await letzte(page))
  pruefe('ein Stand ohne Tonhöhe liest mit der Vorgabe',
    (await letzte(page)).hoehe === 1, await letzte(page))
  await browser.close()
}

// =========================================================================
// D · Nur eine deutsche Stimme — und nachträglich eine zweite
// =========================================================================
{
  const { browser, page } = await sitzung([
    { name: 'Anna', lang: 'de-DE' },
    { name: 'Samantha', lang: 'en-US' },
  ])
  const abschnitt = await zumStimmenabschnitt(page)
  pruefe('mit nur einer Stimme gibt es den Abschnitt trotzdem',
    (await abschnitt.count()) === 1)
  pruefe('aber keinen Auswahlblock, der nichts auswählt',
    (await abschnitt.getByRole('radiogroup', { name: 'Stimme' }).count()) === 0)
  pruefe('der Name der Stimme steht trotzdem da',
    (await abschnitt.innerText()).includes('Anna'))
  pruefe('Tempo und Tonhöhe stehen zur Verfügung',
    (await abschnitt.getByRole('radiogroup', { name: 'Tempo' }).count()) === 1 &&
    (await abschnitt.getByRole('radiogroup', { name: 'Tonhöhe' }).count()) === 1)

  const anleitung = abschnitt.locator('details').first()
  pruefe('zugeklappt steht die Anleitung nicht im Weg',
    !(await anleitung.innerText()).includes('Österreich'))
  await anleitung.locator('summary').click()
  await page.waitForTimeout(400)
  const hilfe = await anleitung.innerText()
  pruefe('aufgeklappt nennt sie den Weg am Handy',
    hilfe.includes('Sprachausgabe') && hilfe.includes('Österreich'), hilfe.slice(0, 220))
  pruefe('und sagt, dass eine Stimme der Normalfall ist',
    hilfe.includes('Normalfall'))

  // Nachträglich installiert — ohne Neuladen.
  await page.evaluate(() => window.__installieren({ name: 'Markus', lang: 'de-DE' }))
  await page.waitForTimeout(600)
  pruefe('eine nachinstallierte Stimme erscheint ohne Neuladen',
    (await abschnitt.getByRole('radiogroup', { name: 'Stimme' }).count()) === 1 &&
    (await abschnitt.innerText()).includes('Markus'))

  await browser.close()
}

// =========================================================================
// E · Gar keine deutsche Stimme
// =========================================================================
{
  const { browser, page } = await sitzung([{ name: 'Samantha', lang: 'en-US' }])
  await insRezept(page, 'Bolognese')
  pruefe('ohne deutsche Stimme gibt es keinen Vorlese-Knopf',
    (await page.getByRole('button', { name: 'Vorlesen', exact: true }).count()) === 0)
  pruefe('die Schritte stehen trotzdem da',
    (await page.locator('body').innerText()).includes('Zwiebeln würfeln.'))

  await zumStimmenabschnitt(page)
  /**
   * Gesucht wird die **Überschrift**, nicht der Text irgendwo auf der Seite:
   * Im Änderungsprotokoll weiter oben steht „Stimme fürs Vorlesen" als Teil
   * eines Satzes, und eine Textsuche fände ihn dort.
   */
  pruefe('und auch keinen Abschnitt in den Einstellungen',
    (await page.locator('summary', { hasText: 'Stimme fürs Vorlesen' }).count()) === 0 &&
    (await page.getByRole('radiogroup', { name: 'Tonhöhe' }).count()) === 0)
  await browser.close()
}

schluss()
