/**
 * Welche Stimme vorliest und wie schnell.
 *
 * **Die App bringt keine Stimmen mit.** Sie benutzt die, die auf dem Gerät
 * liegen. Gewählt wird deshalb ein *Name*, kein Gegenstand: Die Stimmenliste
 * wird bei jedem Start neu vom Browser geliefert, und was gestern da war, kann
 * nach einem Android-Update fehlen. Genau dieser Fall ist der Grund, warum die
 * Wahl hier durch `pickVoiceName` läuft statt direkt benutzt zu werden.
 */

export type Tempo = 'langsam' | 'normal' | 'zuegig'

/**
 * Die drei Stufen als Werte für `utterance.rate`.
 *
 * `normal` ist mit 0,95 der Wert, mit dem bisher kommentarlos vorgelesen wurde
 * — wer nichts umstellt, hört also weiterhin genau dasselbe. Nach unten ist
 * mehr Abstand als nach oben: Wer langsamer stellt, hat den Text nicht
 * verstanden, und ein halber Schritt hülfe da nicht.
 */
export const TEMPO: Record<Tempo, number> = {
  langsam: 0.8,
  normal: 0.95,
  zuegig: 1.15,
}

/** Die Stufen in der Reihenfolge, in der sie nebeneinanderstehen. */
export const TEMPO_ORDER: Tempo[] = ['langsam', 'normal', 'zuegig']

export const TEMPO_LABELS: Record<Tempo, string> = {
  langsam: 'Langsam',
  normal: 'Normal',
  zuegig: 'Zügig',
}

/**
 * Welche Stimme genommen wird.
 *
 * Der gewählte Name, wenn es ihn auf **diesem** Gerät gibt — sonst die erste
 * deutsche, sonst gar keine. Der Rückfall ist der eigentliche Zweck: Die Wahl
 * liegt je Gerät, und eine Stimme, die auf dem anderen Handy fehlt oder nach
 * einem Update verschwunden ist, darf das Vorlesen nicht abwürgen. Lieber eine
 * andere Stimme als Schweigen.
 */
export function pickVoiceName(
  vorhanden: readonly string[],
  gewaehlt: string | null,
): string | null {
  if (gewaehlt && vorhanden.includes(gewaehlt)) return gewaehlt
  return vorhanden[0] ?? null
}

/**
 * Einen gespeicherten Stand als Stufe lesen.
 *
 * Was aus dem Browserspeicher kommt, ist erst einmal nur „irgendetwas" — ein
 * Stand aus einer älteren Fassung, von Hand verändert, beschädigt. Alles, was
 * keine der drei Stufen ist, wird zu `normal`.
 */
export function toTempo(value: unknown): Tempo {
  return value === 'langsam' || value === 'zuegig' || value === 'normal'
    ? value
    : 'normal'
}

/** Was je Gerät gespeichert wird. */
export interface VoiceChoice {
  /** Der Name der Stimme — `null` heißt „keine Wahl getroffen". */
  name: string | null
  tempo: Tempo
}

export const DEFAULT_VOICE_CHOICE: VoiceChoice = { name: null, tempo: 'normal' }

/** Einen gelesenen Stand auf die Form der Wahl bringen. */
export function toVoiceChoice(value: unknown): VoiceChoice {
  if (typeof value !== 'object' || value === null) return DEFAULT_VOICE_CHOICE
  const stand = value as Record<string, unknown>
  const name = typeof stand.name === 'string' && stand.name.trim() !== ''
    ? stand.name
    : null
  return { name, tempo: toTempo(stand.tempo) }
}
