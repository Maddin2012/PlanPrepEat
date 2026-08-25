import { describe, expect, it } from 'vitest'
import { INVITE_PATH, inviteUrl, parseInviteCode } from './invite.ts'

/**
 * Der Einladungslink ersetzt das Abtippen des Haushalts-Codes. Baut ihn eine
 * Seite anders zusammen, als die andere ihn liest, landet die eingeladene
 * Person in einer Fehlermeldung statt im Haushalt — und hat keine Möglichkeit,
 * das selbst zu reparieren.
 */

const ID = 'ABCDEFGHJKMNPQRS'
const BASIS = 'https://beispiel.test/PlanPrepEat/'

/** Was aus einem fertigen Link wieder herausgelesen wird. */
function rueckweg(url: string): string | null {
  return parseInviteCode(url.split(`#${INVITE_PATH}/`)[1])
}

describe('inviteUrl', () => {
  it('führt über den Rückweg zur selben Kennung', () => {
    expect(rueckweg(inviteUrl(ID, BASIS))).toBe(ID)
  })

  it('schreibt den Code in Vierergruppen, nicht am Stück', () => {
    // Falls ihn doch jemand vorliest oder abschreibt.
    expect(inviteUrl(ID, BASIS)).toBe(
      'https://beispiel.test/PlanPrepEat/#/beitreten/ABCD-EFGH-JKMN-PQRS',
    )
  })

  it('hängt sich an ein abweichendes Unterverzeichnis an', () => {
    // Auf GitHub Pages liegt die App unter /<repo>/, lokal unter /.
    expect(inviteUrl(ID, 'https://beispiel.test/')).toBe(
      'https://beispiel.test/#/beitreten/ABCD-EFGH-JKMN-PQRS',
    )
  })
})

describe('parseInviteCode', () => {
  it('nimmt Kleinschreibung, Leerzeichen und fehlende Bindestriche hin', () => {
    for (const eingabe of [
      'abcd-efgh-jkmn-pqrs',
      'ABCDEFGHJKMNPQRS',
      'ABCD EFGH JKMN PQRS',
      'abcd efgh-JKMN pqrs',
    ]) {
      expect(parseInviteCode(eingabe)).toBe(ID)
    }
  })

  it('versteht einen Link, dessen Bindestriche als %2D ankamen', () => {
    expect(parseInviteCode('ABCD%2DEFGH%2DJKMN%2DPQRS')).toBe(ID)
  })

  it('weist einen abgeschnittenen Link ab, statt ihn durchzulassen', () => {
    // Der wichtigste Fall: Eine weitergeleitete Nachricht verliert das Ende.
    // Ein zu kurzer Code dürfte nicht als gültig gelten — sonst steht die
    // eingeladene Person vor einer nichtssagenden Firebase-Meldung.
    expect(parseInviteCode('ABCD-EFGH')).toBeNull()
  })

  it('weist zu lang, leer und fehlend ab', () => {
    expect(parseInviteCode('ABCD-EFGH-JKMN-PQRS-TUVW')).toBeNull()
    expect(parseInviteCode('')).toBeNull()
    expect(parseInviteCode(undefined)).toBeNull()
    expect(parseInviteCode('----')).toBeNull()
  })
})
