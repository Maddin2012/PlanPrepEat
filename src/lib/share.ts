export type ShareResult = 'shared' | 'cancelled' | 'copied' | 'failed'

export function canShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

/**
 * Öffnet den Teilen-Dialog des Geräts. Auf Android erscheint darin Google
 * Notizen (Keep) als Ziel — ein Tipp und die Liste liegt als Notiz im Konto.
 *
 * Warum nicht direkt in Keep schreiben? Weil es für private Google-Konten keine
 * Keep-Schnittstelle gibt; die offizielle Programmierschnittstelle ist
 * Firmenkonten mit Administrator-Freigabe vorbehalten. Der Teilen-Dialog ist der
 * einzige Weg, der ohne Anmeldung und ohne Umwege zuverlässig funktioniert.
 *
 * Wo es ihn nicht gibt (Desktop-Browser), landet der Text in der Zwischenablage.
 */
export async function shareText(payload: {
  title?: string
  text: string
}): Promise<ShareResult> {
  if (canShare()) {
    try {
      await navigator.share({ title: payload.title, text: payload.text })
      return 'shared'
    } catch (error) {
      // Wischt die Person den Dialog weg, ist das kein Fehler.
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled'
      }
      // Alles andere (kein Ziel installiert, blockiert) fängt die Zwischenablage auf.
      return (await copyText(payload.text)) ? 'copied' : 'failed'
    }
  }

  return (await copyText(payload.text)) ? 'copied' : 'failed'
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Ohne sicheren Kontext oder ohne Erlaubnis: unten weiterversuchen.
  }
  return copyViaTextarea(text)
}

/** Notlösung für Browser ohne Clipboard-Schnittstelle. */
function copyViaTextarea(text: string): boolean {
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.append(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  } catch {
    return false
  }
}
