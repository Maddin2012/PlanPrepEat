/**
 * Das Zusammensetzen eines Diktats.
 *
 * **Die Grenze zwischen zwei Zutaten zieht der Mensch, nicht die Uhr.** Vorher
 * galt ein Abschnitt nach 1,2 Sekunden unveränderten Textes als fertig. Wer
 * beim Sprechen überlegt — „fünfhundert Gramm … äh … Mehl" — bekam daraus zwei
 * Zutaten. Jetzt wird gesammelt, bis jemand `take()` ruft.
 *
 * Das steht hier und nicht in `lib/speech.ts`, weil es reine Rechnerei ist:
 * Genau an dieser Stelle saß der gemeldete Fehler, und sie war nur im Browser
 * prüfbar.
 */

export interface DictationBuffer {
  /** Eine als „endgültig" gemeldete Äußerung aufnehmen. */
  absorb(text: string): void
  /** Alles seit der letzten Grenze. */
  text(): string
  /** Grenze ziehen: gibt den Text zurück und fängt von vorn an. */
  take(): string
}

export function dictationBuffer(): DictationBuffer {
  /** Abgeschlossene Äußerungen seit der letzten Grenze. */
  let gesammelt = ''
  /** Die Äußerung, die gerade gesprochen wird. */
  let laufend = ''

  const zusammen = () => `${gesammelt} ${laufend}`.trim().replace(/\s+/gu, ' ')

  return {
    absorb(text) {
      const next = text.trim()
      if (!next) return

      if (laufend && !sameUtterance(laufend, next)) {
        // **Hier lag der Fehler.** Vorher wurde an dieser Stelle abgegeben und
        // damit eine neue Zutat angefangen. Jetzt wird angehängt — die Grenze
        // kommt von außen.
        gesammelt = `${gesammelt} ${laufend}`.trim()
        laufend = next
        return
      }

      // Dieselbe Äußerung, nur kürzer gemeldet: Nach einem Neustart liefert
      // Android den Satz mitunter verkürzt nach. Der längere Stand bleibt.
      if (next.length <= laufend.length) return

      laufend = next
    },

    text: zusammen,

    take() {
      const alles = zusammen()
      gesammelt = ''
      laufend = ''
      return alles
    },
  }
}

/**
 * Zwei Fassungen derselben Äußerung?
 *
 * **Chrome auf Android markiert Zwischenstände fälschlich als endgültig** und
 * liefert sie wachsend nach — erst „500", dann „500 g", dann „500 g Mehl". Wer
 * jedes davon als eigene Äußerung nimmt, bekommt aus einer Zutat drei.
 *
 * Ob dabei die Ergebnis-Nummer hochgezählt wird oder zwischen den Teilstücken
 * die Sitzung endet, ist von Gerät zu Gerät verschieden. Verlässlich ist nur
 * der Text selbst: Ist eine Fassung der Anfang der anderen, ist es dieselbe
 * Äußerung. Beide Richtungen zählen — auch die kürzere, siehe oben.
 */
function sameUtterance(a: string, b: string): boolean {
  const eins = a.trim().toLocaleLowerCase('de')
  const zwei = b.trim().toLocaleLowerCase('de')
  return eins.startsWith(zwei) || zwei.startsWith(eins)
}
