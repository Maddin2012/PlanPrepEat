/**
 * Zeichnet das App-Symbol und rendert es zu PNG.
 *
 * Ein PNG kann niemand von Hand nachbessern — deshalb liegt hier die Quelle,
 * und die Dateien in `public/` sind nur das Ergebnis. Wer die Farbe oder die
 * Form ändern will, ändert sie hier und lässt das Skript neu laufen:
 *
 *     node scripts/icons.mjs            # dunkle Kachel nach public/
 *     node scripts/icons.mjs --hell     # helle Kachel nach public/
 *     node scripts/icons.mjs --ziel /tmp/vergleich
 *
 * Playwright ist absichtlich **keine** deklarierte Abhängigkeit: Es wird nur
 * hier gebraucht, und das Projekt soll ohne einen 300-MB-Browser bauen und
 * testen können. Für dieses Skript muss es vorhanden sein — `npm i -D playwright`
 * oder eine bestehende Installation.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

/** Die Farben aus dem Logo. */
export const SCHIEFER = '#2b3034'
export const GOLD = '#c8a34a'
export const CREME = '#f4efe6'

/**
 * Besteck als gefüllte Silhouette — nicht als Strichzeichnung wie die Symbole
 * in der App. Alle Teile sind auf denselben lokalen Raum gezeichnet: Mitte bei
 * 0, Spitze bei y = −180, Griffende bei y = 180. Dadurch lassen sich Gabel und
 * Messer ohne Umrechnen gegeneinander drehen.
 *
 * Der kleine gleichfarbige Rand (`stroke` in der Füllfarbe, runde Ecken) rundet
 * sämtliche Kanten ab — das spart Dutzende Kurvenbefehle im Pfad.
 *
 * **Er darf nicht breiter werden, um das Zeichen kräftiger zu machen.** Der Rand
 * wächst nach außen, also verliert jede Lücke zwischen zwei Zinken seine volle
 * Breite. Bei 9 statt 7 war die Gabel ein Pfannenwender. Kräftiger wird das
 * Zeichen über Maßstab, Griffbreite und Kopfbreite — nicht hierüber.
 */
function weich(farbe) {
  return `fill="${farbe}" stroke="${farbe}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"`
}

/**
 * Die Pfaddaten stehen als eigene Konstanten da, weil `src/components/Logo.tsx`
 * dieselben Formen zeichnet und `src/components/Logo.test.tsx` beide
 * gegeneinander hält. Wer hier etwas ändert, muss dort mitziehen — sonst wird
 * der Test rot.
 */
export const MESSER_KLINGE =
  'M 0 -180 C -8 -158 -15 -140 -15 -118 L -15 26 L 19 26 L 19 -50 C 19 -108 11 -154 0 -180 Z'

// Absichtlich als eine lange Zeile ohne Verkettung: Der Test in
// src/components/Logo.test.tsx sucht diesen String wörtlich in dieser Datei.
export const GABEL_KOPF =
  'M -45 -96 L -45 -176 L -33 -176 L -33 -106 L -19 -106 L -19 -176 L -7 -176 L -7 -106 L 7 -106 L 7 -176 L 19 -176 L 19 -106 L 33 -106 L 33 -176 L 45 -176 L 45 -96 C 45 -68 31 -50 17 -42 L 17 26 L -17 26 L -17 -42 C -31 -50 -45 -68 -45 -96 Z'

function messer(körper, gold) {
  return `
    <g ${weich(körper)}>
      <path d="${MESSER_KLINGE}"/>
      <rect x="-20" y="18" width="42" height="20" rx="7"/>
      <rect x="-18" y="32" width="38" height="146" rx="19"/>
    </g>
    ${
      gold
        ? `<g>
      <path d="M -8 -128 L -8 16" fill="none" stroke="${gold}" stroke-width="6" stroke-linecap="round"/>
      <rect x="-18" y="36" width="38" height="9" rx="4.5" fill="${gold}"/>
      <circle cx="1" cy="82" r="6" fill="${gold}"/>
      <circle cx="1" cy="114" r="6" fill="${gold}"/>
      <circle cx="1" cy="146" r="6" fill="${gold}"/>
    </g>`
        : ''
    }`
}

function gabel(körper, gold) {
  return `
    <g ${weich(körper)}>
      <path d="${GABEL_KOPF}"/>
      <rect x="-21" y="18" width="42" height="20" rx="7"/>
      <rect x="-19" y="32" width="38" height="146" rx="19"/>
    </g>
    ${
      gold
        ? `<g>
      <path d="M 0 -78 L 0 16" fill="none" stroke="${gold}" stroke-width="6" stroke-linecap="round"/>
      <rect x="-19" y="36" width="38" height="9" rx="4.5" fill="${gold}"/>
      <circle cx="0" cy="82" r="6" fill="${gold}"/>
      <circle cx="0" cy="114" r="6" fill="${gold}"/>
      <circle cx="0" cy="146" r="6" fill="${gold}"/>
    </g>`
        : ''
    }`
}

/**
 * Das Zeichen auf 512×512.
 *
 * `einfach` lässt die goldenen Haarlinien, die Nieten und die beiden äußeren
 * Messer weg und macht das Kreuz dafür größer. Bei 48 Pixel — der Größe auf dem
 * Startbildschirm — laufen drei Klingen sonst ineinander und die Goldlinien
 * verschwinden ohnehin.
 */
export function zeichen(körper, { einfach = false, skalierung = 1 } = {}) {
  const inhalt = einfach
    ? `<g transform="translate(0 6) rotate(-24) scale(1.12)">${gabel(körper, null)}</g>
       <g transform="translate(0 6) rotate(24) scale(1.12)">${messer(körper, null)}</g>
       <g transform="translate(0 6) rotate(-24) scale(1.12)">
         <rect x="-19" y="36" width="38" height="13" rx="6.5" fill="${GOLD}"/>
       </g>
       <g transform="translate(0 6) rotate(24) scale(1.12)">
         <rect x="-18" y="36" width="38" height="13" rx="6.5" fill="${GOLD}"/>
       </g>`
    : `<g transform="translate(-152 0) scale(-0.64 0.64)">${messer(körper, GOLD)}</g>
       <g transform="translate(152 0) scale(0.64 0.64)">${messer(körper, GOLD)}</g>
       <g transform="translate(0 2) rotate(-21) scale(0.80)">${gabel(körper, GOLD)}</g>
       <g transform="translate(0 2) rotate(21) scale(0.80)">${messer(körper, GOLD)}</g>`

  return `<g transform="translate(256 256) scale(${skalierung})">${inhalt}</g>`
}

/**
 * Eine App-Kachel als SVG.
 *
 * `maskierbar` heißt: keine runden Ecken und das Zeichen kleiner. Android legt
 * bei solchen Symbolen eine eigene Maske darüber — mal einen Kreis, mal ein
 * Quadrat mit runden Ecken. Was außerhalb des mittleren Kreises mit 80 % des
 * Durchmessers liegt, kann abgeschnitten werden.
 */
// Gemessen, nicht geschätzt: Bei diesem Faktor reicht das Zeichen 193 Pixel vom
// Mittelpunkt weg, der Sicherheitskreis erlaubt 205. Wer ihn erhöht, muss neu
// messen — ab etwa 0,97 schneidet der Kreis die Griffe an.
export const MASKE_SKALIERUNG = 0.92

export function kachel({ dunkel = true, einfach = false, maskierbar = false } = {}) {
  const grund = dunkel ? SCHIEFER : CREME
  const körper = dunkel ? CREME : SCHIEFER
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="PlanPrepEat">
  <rect width="512" height="512" rx="${maskierbar ? 0 : 112}" fill="${grund}"/>
  ${zeichen(körper, { einfach, skalierung: maskierbar ? MASKE_SKALIERUNG : 1 })}
</svg>
`
}

const hier = dirname(fileURLToPath(import.meta.url))

async function main() {
  const argumente = process.argv.slice(2)
  const dunkel = !argumente.includes('--hell')
  const zielIndex = argumente.indexOf('--ziel')
  const ziel =
    zielIndex >= 0
      ? resolve(argumente[zielIndex + 1])
      : resolve(hier, '..', 'public')

  await mkdir(ziel, { recursive: true })

  // Die feine Fassung ist das Herkunftsbild: als SVG skaliert sie verlustfrei,
  // und der Browser-Tab nimmt sie direkt.
  await writeFile(join(ziel, 'favicon.svg'), kachel({ dunkel }))

  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? '/opt/pw-browsers/chromium',
  })
  const page = await browser.newPage()

  const dateien = [
    // 192 wird klein angezeigt — da gehört die vereinfachte Fassung hin.
    { name: 'icon-192.png', größe: 192, einfach: true },
    { name: 'icon-512.png', größe: 512, einfach: false },
    { name: 'icon-maskable.png', größe: 512, einfach: true, maskierbar: true },
  ]

  for (const { name, größe, einfach, maskierbar } of dateien) {
    const svg = kachel({ dunkel, einfach, maskierbar })
    await page.setViewportSize({ width: größe, height: größe })
    await page.setContent(
      `<style>html,body{margin:0;padding:0}svg{display:block;width:${größe}px;height:${größe}px}</style>${svg}`,
    )
    await page.locator('svg').screenshot({ path: join(ziel, name), omitBackground: true })
    console.log(`${name} (${größe}px${maskierbar ? ', maskierbar' : ''})`)
  }

  await browser.close()
  console.log(`fertig — ${dunkel ? 'dunkle' : 'helle'} Kachel in ${ziel}`)
}

// Nur ausführen, wenn direkt aufgerufen; als Import liefert die Datei nur die
// Zeichenfunktionen (der Vergleichsbogen benutzt sie).
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  await main()
}
