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
 */
function weich(farbe) {
  return `fill="${farbe}" stroke="${farbe}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"`
}

function messer(körper, gold) {
  return `
    <g ${weich(körper)}>
      <path d="M 0 -180 C -8 -158 -14 -140 -14 -118 L -14 26 L 18 26 L 18 -50 C 18 -102 10 -152 0 -180 Z"/>
      <rect x="-17" y="18" width="37" height="20" rx="6"/>
      <rect x="-15" y="32" width="32" height="146" rx="16"/>
    </g>
    ${
      gold
        ? `<g>
      <path d="M -7 -128 L -7 16" fill="none" stroke="${gold}" stroke-width="5" stroke-linecap="round"/>
      <rect x="-15" y="36" width="32" height="8" rx="4" fill="${gold}"/>
      <circle cx="1" cy="82" r="5.5" fill="${gold}"/>
      <circle cx="1" cy="114" r="5.5" fill="${gold}"/>
      <circle cx="1" cy="146" r="5.5" fill="${gold}"/>
    </g>`
        : ''
    }`
}

function gabel(körper, gold) {
  return `
    <g ${weich(körper)}>
      <path d="M -41 -96 L -41 -176 L -28 -176 L -28 -106 L -18 -106 L -18 -176
               L -5 -176 L -5 -106 L 5 -106 L 5 -176 L 18 -176 L 18 -106
               L 28 -106 L 28 -176 L 41 -176 L 41 -96
               C 41 -68 29 -50 14 -42 L 14 26 L -14 26 L -14 -42
               C -29 -50 -41 -68 -41 -96 Z"/>
      <rect x="-17" y="18" width="34" height="20" rx="6"/>
      <rect x="-16" y="32" width="32" height="146" rx="16"/>
    </g>
    ${
      gold
        ? `<g>
      <path d="M 0 -78 L 0 16" fill="none" stroke="${gold}" stroke-width="5" stroke-linecap="round"/>
      <rect x="-16" y="36" width="32" height="8" rx="4" fill="${gold}"/>
      <circle cx="0" cy="82" r="5.5" fill="${gold}"/>
      <circle cx="0" cy="114" r="5.5" fill="${gold}"/>
      <circle cx="0" cy="146" r="5.5" fill="${gold}"/>
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
    ? `<g transform="translate(0 6) rotate(-24) scale(0.92)">${gabel(körper, null)}</g>
       <g transform="translate(0 6) rotate(24) scale(0.92)">${messer(körper, null)}</g>
       <g transform="translate(0 6) rotate(-24) scale(0.92)">
         <rect x="-16" y="36" width="32" height="10" rx="5" fill="${GOLD}"/>
       </g>
       <g transform="translate(0 6) rotate(24) scale(0.92)">
         <rect x="-15" y="36" width="32" height="10" rx="5" fill="${GOLD}"/>
       </g>`
    : `<g transform="translate(-146 0) scale(-0.60 0.60)">${messer(körper, GOLD)}</g>
       <g transform="translate(146 0) scale(0.60 0.60)">${messer(körper, GOLD)}</g>
       <g transform="translate(0 2) rotate(-21) scale(0.74)">${gabel(körper, GOLD)}</g>
       <g transform="translate(0 2) rotate(21) scale(0.74)">${messer(körper, GOLD)}</g>`

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
export function kachel({ dunkel = true, einfach = false, maskierbar = false } = {}) {
  const grund = dunkel ? SCHIEFER : CREME
  const körper = dunkel ? CREME : SCHIEFER
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="Meal Master">
  <rect width="512" height="512" rx="${maskierbar ? 0 : 112}" fill="${grund}"/>
  ${zeichen(körper, { einfach, skalierung: maskierbar ? 0.78 : 1 })}
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
