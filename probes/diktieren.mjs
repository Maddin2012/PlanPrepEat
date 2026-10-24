/**
 * Diktat: Die Grenzen setzt der Mensch.
 *
 * Martins Meldung: „Wenn ich auf die Spracheingabe tippe, fügt er automatisch
 * immer eine neue Zutat hinzu — die Zeitspanne ist zu kurz." Ursache war ein
 * Zeitgeber: 1,2 Sekunden unveränderter Text galten als fertige Zutat.
 *
 * Die Attrappe stellt die Eigenheiten von Chrome auf Android nach, weil genau
 * daran die Logik hängt: „endgültige" Ergebnisse kommen **wachsend** nach, und
 * die Sitzung endet nach jeder Sprechpause und muss neu gestartet werden.
 */

import { abbruch, pruefer, starteApp } from './helfer.mjs'

const { pruefe, notiz, schluss } = pruefer()

/** Attrappe für `SpeechRecognition`. */
const attrappe = `
window.__spracheingabe = { laeufe: 0, laufend: null }

class FakeRecognition {
  constructor() {
    this.lang = ''
    this.continuous = false
    this.interimResults = false
    this.onresult = null
    this.onerror = null
    this.onend = null
    this._index = 0
  }
  start() {
    window.__spracheingabe.laeufe += 1
    window.__spracheingabe.laufend = this
  }
  stop() {
    if (window.__spracheingabe.laufend === this) window.__spracheingabe.laufend = null
    if (this.onend) this.onend()
  }
  abort() { this.stop() }
}
Object.defineProperty(window, 'SpeechRecognition', {
  value: FakeRecognition, configurable: true,
})
Object.defineProperty(window, 'webkitSpeechRecognition', {
  value: FakeRecognition, configurable: true,
})

/** Eine als endgültig gemeldete Äußerung schicken. */
window.__sprich = (text) => {
  const r = window.__spracheingabe.laufend
  if (!r || !r.onresult) return false
  const ergebnis = { isFinal: true, 0: { transcript: text }, length: 1 }
  const results = { length: r._index + 1 }
  results[r._index] = ergebnis
  const index = r._index
  r._index += 1
  r.onresult({ resultIndex: index, results })
  return true
}

/** Einen Zwischenstand schicken — noch nicht endgültig. */
window.__zwischen = (text) => {
  const r = window.__spracheingabe.laufend
  if (!r || !r.onresult) return false
  const results = { length: r._index + 1 }
  results[r._index] = { isFinal: false, 0: { transcript: text }, length: 1 }
  r.onresult({ resultIndex: r._index, results })
  return true
}

/**
 * Eine Sprechpause, wie Android sie behandelt: Die Sitzung endet, die App
 * startet von selbst neu. **Vorher war genau das der Moment, in dem eine neue
 * Zutat entstand.**
 */
window.__pause = () => {
  const r = window.__spracheingabe.laufend
  if (r && r.onend) r.onend()
}
`

const { browser, page } = await starteApp({ pruefe, initSkript: attrappe })

const sprich = (text) => page.evaluate((t) => window.__sprich(t), text)
const pause = () => page.evaluate(() => window.__pause())
const warten = (ms = 300) => page.waitForTimeout(ms)

/** Zum Formular für ein neues Rezept. */
await page.getByRole('link', { name: /Erstes Rezept anlegen|Rezept hinzufügen/ }).first().click()
await warten(500)

const zutatFelder = () => page.getByLabel('Zutat', { exact: true })
const mengeFelder = () => page.getByLabel('Menge', { exact: true })
const werte = async (locator) =>
  locator.evaluateAll((els) => els.map((el) => el.value))

const leiste = () => page.locator('div.fixed.bottom-3').first()
const naechsteZutat = () => page.getByRole('button', { name: 'Nächste Zutat' })
const fertig = () => leiste().getByRole('button', { name: 'Fertig' })

// === 1 · Martins Fall ====================================================
/**
 * „500 Gramm" — Pause über zwei Sekunden — „Mehl". Vorher wurden daraus zwei
 * Zutaten. Diese Prüfung ist gegen den alten Stand rot.
 */
await page.getByRole('button', { name: 'Zutaten diktieren' }).click()
await warten(400)
pruefe('die Diktatleiste steht da', await leiste().isVisible())

await sprich('500 Gramm')
await warten(300)
await pause()
// Deutlich länger als die alten 1,2 Sekunden.
await warten(2200)

const nachPause = await werte(zutatFelder())
notiz('Zutatenfelder nach der Pause', nachPause)
pruefe('eine lange Pause legt von sich aus keine Zutat an',
  nachPause.filter((v) => v.trim()).length === 0, nachPause)

await sprich('Mehl')
await warten(400)
pruefe('die Leiste zeigt den ganzen gesammelten Text',
  (await leiste().innerText()).includes('500 Gramm Mehl'),
  await leiste().innerText())

// === 2 · Die Grenze setzt der Tipp =======================================
await naechsteZutat().click()
await warten(500)
await abbruch(page)

const nachErster = await werte(zutatFelder())
const mengenNachErster = await werte(mengeFelder())
notiz('nach „Nächste Zutat"', { nachErster, mengenNachErster })
pruefe('aus „500 Gramm" + Pause + „Mehl" wird EINE Zutat',
  nachErster.filter((v) => v.trim()).length === 1, nachErster)
pruefe('und sie heißt „Mehl"', nachErster[0] === 'Mehl', nachErster[0])
pruefe('die Menge ist dabei angekommen', mengenNachErster[0] === '500',
  mengenNachErster[0])

// === 3 · Die zweite Zutat ================================================
await sprich('zwei Zwiebeln')
await warten(400)
await naechsteZutat().click()
await warten(500)
const nachZweiter = await werte(zutatFelder())
notiz('nach der zweiten', nachZweiter)
pruefe('die zweite Zutat landet in einer eigenen Zeile',
  nachZweiter.filter((v) => v.trim()).length === 2, nachZweiter)
pruefe('die erste bleibt unverändert', nachZweiter[0] === 'Mehl', nachZweiter[0])
pruefe('die zweite heißt „Zwiebeln"', nachZweiter[1] === 'Zwiebeln', nachZweiter[1])

// === 4 · Wachsende Fassungen zählen einmal ===============================
/** Chrome meldet „500", „500 g", „500 g Zucker" alle als endgültig. */
await sprich('200')
await sprich('200 g')
await sprich('200 g Zucker')
await warten(300)
await fertig().click()
await warten(600)
await abbruch(page)

const amEnde = await werte(zutatFelder())
notiz('nach „Fertig"', amEnde)
pruefe('wachsende Fassungen ergeben eine Zutat, nicht drei',
  amEnde.filter((v) => v.trim()).length === 3, amEnde)
pruefe('und sie heißt „Zucker"', amEnde[2] === 'Zucker', amEnde[2])
pruefe('„Fertig" beendet das Zuhören', !(await leiste().isVisible().catch(() => false)))

// === 5 · Die Zubereitung wird nicht an Punkten zerlegt ==================
await page.getByRole('button', { name: 'Zubereitung diktieren' }).click()
await warten(400)
pruefe('beim Diktat der Zubereitung heißt der Knopf „Nächster Schritt"',
  (await page.getByRole('button', { name: 'Nächster Schritt' }).count()) === 1)

await sprich('Zwiebeln würfeln. Dann anbraten.')
await warten(300)
await page.getByRole('button', { name: 'Nächster Schritt' }).click()
await warten(500)

const schritte = async () =>
  page.locator('textarea').evaluateAll((els) =>
    els.map((el) => el.value).filter((v) => v.trim()))

notiz('Schritte', await schritte())
pruefe('zwei Sätze bleiben EIN Schritt',
  (await schritte()).length === 1, await schritte())
pruefe('und der Schritt enthält beide Sätze',
  (await schritte())[0] === 'Zwiebeln würfeln. Dann anbraten.', (await schritte())[0])

await sprich('Bei 180 Grad überbacken.')
await warten(300)
await page.getByRole('button', { name: 'Nächster Schritt' }).click()
await warten(500)
pruefe('erst mein Tipp fängt den zweiten Schritt an',
  (await schritte()).length === 2, await schritte())

await leiste().getByRole('button', { name: 'Fertig' }).click()
await warten(500)

await page.screenshot({ path: new URL('103-diktieren.png', import.meta.url).pathname })

// === 6 · Das kleine Mikrofon an der Zeile ================================
await page.getByRole('button', { name: 'Diese Zutat diktieren' }).first().click()
await warten(400)
pruefe('dort gibt es kein „Nächste Zutat" — es ist nur eine Zeile',
  (await naechsteZutat().count()) === 0)

await sprich('300 Gramm')
await warten(200)
await pause()
await warten(2200)
await sprich('Nudeln')
await warten(300)
await leiste().getByRole('button', { name: 'Fertig' }).click()
await warten(600)
await abbruch(page)

const nachZeile = await werte(zutatFelder())
notiz('nach dem Zeilen-Mikrofon', nachZeile)
pruefe('eine Pause schneidet auch hier nicht ab',
  nachZeile[0] === 'Nudeln', nachZeile[0])

// === 7 · Das Namensfeld ==================================================
/**
 * Hier ersetzte vorher jeder Abschnitt den Namen: Nach einer Pause stand nur
 * die zweite Hälfte da. Gemeldet hatte Martin das nicht — es ist dieselbe
 * Ursache.
 */
await page.getByRole('button', { name: 'Name diktieren' }).click()
await warten(400)
await sprich('Kartoffel')
await warten(200)
await pause()
await warten(2200)
await sprich('auflauf')
await warten(300)
await leiste().getByRole('button', { name: 'Fertig' }).click()
await warten(600)

const name = await page.getByLabel('Name', { exact: true }).inputValue()
notiz('Name', name)
pruefe('eine Pause im Namen ersetzt ihn nicht mehr',
  name === 'Kartoffel auflauf', name)

// === 8 · Nach vielen Pausen hört es nicht von selbst auf =================
/**
 * Chrome endet nach **jeder** Pause und wird neu gestartet. Die Obergrenze
 * dafür zählt jetzt nur noch ununterbrochene Fehlstarts — sonst verstummte ein
 * langes Rezept mitten im Diktat.
 */
await page.getByRole('button', { name: 'Zutaten diktieren' }).click()
await warten(400)
for (let runde = 0; runde < 25; runde += 1) {
  await sprich(`Zutat ${runde}`)
  await pause()
  await warten(60)
}
await warten(500)
pruefe('nach 25 Sprechpausen hört die App immer noch zu',
  await leiste().isVisible(), { laeufe: await page.evaluate(() => window.__spracheingabe.laeufe) })

await browser.close()
schluss()
