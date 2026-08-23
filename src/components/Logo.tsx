/**
 * Das Zeichen und der Schriftzug der App.
 *
 * **Dieselbe Zeichnung liegt zweimal** — hier für die Oberfläche und in
 * `scripts/icons.mjs` für die Symboldateien. Zusammenlegen geht nicht: Das
 * Skript lädt Playwright und darf deshalb nicht ins Bündel, und umgekehrt kann
 * eine React-Komponente keine PNG-Dateien schreiben.
 *
 * Damit die beiden nicht auseinanderlaufen, vergleicht `Logo.test.tsx` die
 * Pfade Zeichen für Zeichen. Wer hier etwas ändert und dort nicht, bekommt
 * einen roten Test statt einer Kopfzeile, deren Logo nicht mehr zum App-Symbol
 * passt.
 */

/** Klinge und Gabelkopf, wörtlich wie in `scripts/icons.mjs`. */
export const MESSER_KLINGE =
  'M 0 -180 C -8 -158 -15 -140 -15 -118 L -15 26 L 19 26 L 19 -50 C 19 -108 11 -154 0 -180 Z'

export const GABEL_KOPF =
  'M -45 -96 L -45 -176 L -33 -176 L -33 -106 L -19 -106 L -19 -176 L -7 -176 L -7 -106 L 7 -106 L 7 -176 L 19 -176 L 19 -106 L 33 -106 L 33 -176 L 45 -176 L 45 -96 C 45 -68 31 -50 17 -42 L 17 26 L -17 26 L -17 -42 C -31 -50 -45 -68 -45 -96 Z'

/** Maßstab und Drehung des gekreuzten Bestecks — ebenfalls dort gespiegelt. */
export const ZEICHEN_MASSSTAB = 1.12
export const ZEICHEN_DREHUNG = 24

/**
 * Der Ausschnitt sitzt eng um die Zeichnung (gemessen, nicht geschätzt), damit
 * das Zeichen seinen Platz ausfüllt statt in Leerraum zu schwimmen.
 */
const AUSSCHNITT = '124 56 264 416'

/** Der weiche Rand rundet die Ecken; er ist Teil der Form, keine Kontur. */
const WEICH = {
  stroke: 'currentColor',
  strokeWidth: 7,
  strokeLinejoin: 'round',
  strokeLinecap: 'round',
} as const

/**
 * Das gekreuzte Besteck, in der Farbe des umgebenden Textes.
 *
 * Bewusst die vereinfachte Fassung ohne die beiden äußeren Messer: In der
 * Kopfzeile ist das Zeichen keine 30 Pixel hoch, da laufen drei Klingen
 * ineinander — dieselbe Überlegung wie beim Symbol auf dem Startbildschirm.
 */
export function Mark({ className }: { className?: string }) {
  const dreh = (richtung: number) =>
    `translate(0 6) rotate(${richtung * ZEICHEN_DREHUNG}) scale(${ZEICHEN_MASSSTAB})`

  return (
    <svg
      viewBox={AUSSCHNITT}
      className={className}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <g transform="translate(256 256)">
        <g transform={dreh(-1)} {...WEICH}>
          <path d={GABEL_KOPF} />
          <rect x="-21" y="18" width="42" height="20" rx="7" />
          <rect x="-19" y="32" width="38" height="146" rx="19" />
        </g>
        <g transform={dreh(1)} {...WEICH}>
          <path d={MESSER_KLINGE} />
          <rect x="-20" y="18" width="42" height="20" rx="7" />
          <rect x="-18" y="32" width="38" height="146" rx="19" />
        </g>
        {/* Der Goldring als einziger Farbtupfer — wie beim App-Symbol. */}
        <g fill="var(--color-gold-500)">
          <g transform={dreh(-1)}>
            <rect x="-19" y="36" width="38" height="13" rx="6.5" />
          </g>
          <g transform={dreh(1)}>
            <rect x="-18" y="36" width="38" height="13" rx="6.5" />
          </g>
        </g>
      </g>
    </svg>
  )
}

export const APP_NAME = 'PlanPrepEat'

/**
 * Zeichen und Name nebeneinander — die Marke, wie sie in der Kopfzeile steht.
 *
 * Der Name ist bewusst Text und kein Bild: Er skaliert mit der eingestellten
 * Schriftgröße mit und lässt sich vorlesen.
 */
export function Brand({ className }: { className?: string }) {
  return (
    <span className={className}>
      <Mark className="h-[1.55em] w-auto shrink-0" />
      <span className="truncate">{APP_NAME}</span>
    </span>
  )
}
