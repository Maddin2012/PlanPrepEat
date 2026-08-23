/**
 * Hell oder dunkel — eine Entscheidung pro Gerät.
 *
 * Bewusst **nicht** an die Systemeinstellung gekoppelt: Wer das Handy nachts
 * automatisch dunkel schaltet, will deswegen nicht zwingend eine dunkle App —
 * und umgekehrt. Die Wahl steht in `localStorage`, gilt also nur für dieses
 * Gerät. Zwei Leute im selben Haushalt können es unterschiedlich haben.
 *
 * Gesetzt wird ein Attribut auf `<html>`; die Farben selbst stehen als
 * Variablen in `src/index.css`.
 */

export type Theme = 'light' | 'dark'

export const THEME_KEY = 'rezeptbuch.theme'

/**
 * Die Farbe der Systemleiste über der App. Muss zur Kopfzeile passen
 * (`bg-surface`), sonst klebt oben ein andersfarbiger Streifen.
 */
export const THEME_COLORS: Record<Theme, string> = {
  light: '#ffffff',
  dark: '#1d2125',
}

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark'
}

/** Die gespeicherte Wahl; ohne Wahl ist es hell. */
export function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    return isTheme(stored) ? stored : 'light'
  } catch {
    // Privater Modus oder gesperrter Speicher — dann eben hell.
    return 'light'
  }
}

/** Schreibt die Fassung ins Dokument, ohne sie zu speichern. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'dark') root.setAttribute('data-theme', 'dark')
  else root.removeAttribute('data-theme')

  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', THEME_COLORS[theme])
}

/** Merkt sich die Wahl und setzt sie sofort um. */
export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Nicht speicherbar — die Wahl gilt dann nur bis zum Neuladen.
  }
  applyTheme(theme)
}
