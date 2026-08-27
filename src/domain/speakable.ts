/**
 * Geschriebenen Rezepttext so aufbereiten, dass eine Stimme ihn richtig
 * ausspricht.
 *
 * Geschrieben und gesprochen ist nicht dasselbe: „2 EL Öl" liest man mühelos,
 * vorgelesen wird daraus je nach Stimme „zwei E L Öl" oder „zwei Ell". Deshalb
 * werden die Abkürzungen für das Vorlesen ausgeschrieben — **nur** für das
 * Vorlesen. Auf dem Bildschirm bleibt der Schritt, wie er getippt wurde.
 *
 * Bewusst kurz gehalten: Hier stehen die Kürzel, die in Rezepten wirklich
 * vorkommen. Alles andere spricht eine deutsche Stimme von sich aus richtig
 * aus, und jede zusätzliche Regel ist eine Gelegenheit, einen normalen Satz zu
 * verunstalten.
 */

/** Kürzel nach einer Zahl: `[Einzahl, Mehrzahl]`. */
const UNITS: Record<string, [string, string]> = {
  g: ['Gramm', 'Gramm'],
  kg: ['Kilogramm', 'Kilogramm'],
  ml: ['Milliliter', 'Milliliter'],
  l: ['Liter', 'Liter'],
  el: ['Esslöffel', 'Esslöffel'],
  tl: ['Teelöffel', 'Teelöffel'],
  msp: ['Messerspitze', 'Messerspitzen'],
  pck: ['Packung', 'Packungen'],
  stk: ['Stück', 'Stück'],
  min: ['Minute', 'Minuten'],
  std: ['Stunde', 'Stunden'],
}

/** Kürzel, die für sich stehen — unabhängig von einer Zahl davor. */
const WORDS: [RegExp, string][] = [
  [/\bca\.\s*/gi, 'circa '],
  [/\bz\.\s*B\.\s*/gi, 'zum Beispiel '],
  [/\bevtl\.\s*/gi, 'eventuell '],
  [/\bggf\.\s*/gi, 'gegebenenfalls '],
  [/\busw\.\s*/gi, 'und so weiter '],
]

/**
 * Die Zahl und ihr Kürzel. Die **ganze** Zahl wird gefasst, nicht nur die
 * letzte Ziffer: Sonst würden aus „21 Min." einundzwanzig Minute.
 *
 * Der Blick nach vorn verhindert den häufigsten Fehlgriff — in „2 Gläser"
 * steckt hinter der Zahl kein Gramm, sondern der Anfang eines Wortes.
 */
const AFTER_NUMBER = /(\d+(?:[.,]\d+)?)(\s*)(kg|ml|msp|pck|stk|min|std|el|tl|g|l)\.?(?![\wäöüßÄÖÜ])/gi

/**
 * Ein Schritt, wie ihn die Stimme lesen soll.
 *
 * Der Rückgabewert ist nur zum Vorlesen gedacht. Er wird nirgends gespeichert
 * und nirgends angezeigt.
 */
export function speakableText(text: string): string {
  let result = text

  // Zuerst die Temperatur: „180 °C" darf nicht vorher an der Zahl hängen
  // bleiben. Das Kürzel „C" wird gleich mit geschluckt.
  result = result.replace(/\s*°\s*C\b/g, ' Grad')
  result = result.replace(/\s*°/g, ' Grad')

  result = result.replace(AFTER_NUMBER, (treffer, zahl: string, _luecke, kuerzel: string) => {
    const wort = UNITS[kuerzel.toLocaleLowerCase('de')]
    if (!wort) return treffer
    return `${zahl} ${zahl === '1' ? wort[0] : wort[1]}`
  })

  for (const [muster, ersatz] of WORDS) result = result.replace(muster, ersatz)

  // Mehrfache Leerzeichen aus den Ersetzungen wieder einsammeln.
  return result.replace(/\s{2,}/g, ' ').trim()
}

/**
 * Die Schritte eines Rezepts als Liste — dieselbe Zerlegung, die die
 * Rezeptseite auch anzeigt.
 */
export function toSteps(steps: string): string[] {
  return steps.split('\n').filter((zeile) => zeile.trim())
}
