import { describe, expect, it } from 'vitest'
import {
  CALENDAR_FUTURE_DAYS,
  CALENDAR_PAST_DAYS,
  DAYS_BEFORE_TODAY,
  WINDOW_DAYS,
  addDays,
  calendarDays,
  calendarRange,
  daysBetween,
  formatDayShort,
  formatRange,
  fromISODate,
  parseSlotKey,
  slotKey,
  toISODate,
  todayISO,
  windowEnd,
  windowStart,
} from './planWindow.ts'

// Fester Bezugspunkt: Freitag, 21.08.2026.
const NOW = new Date(2026, 7, 21, 10, 0)
const TODAY = '2026-08-21'

describe('toISODate / fromISODate', () => {
  it('bleibt beim lokalen Kalendertag, auch spät abends', () => {
    // Über toISOString() wäre daraus je nach Zeitzone der 27. geworden.
    expect(toISODate(new Date(2026, 7, 26, 23, 30))).toBe('2026-08-26')
  })

  it('liest ein ISO-Datum als lokale Mitternacht', () => {
    const date = fromISODate('2026-08-26')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(7)
    expect(date.getDate()).toBe(26)
    expect(date.getHours()).toBe(0)
  })

  it('übersteht einen Monatswechsel', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('übersteht die Sommerzeit-Umstellung', () => {
    // In Deutschland endet die Sommerzeit am 25.10.2026.
    expect(addDays('2026-10-24', 3)).toBe('2026-10-27')
  })
})

describe('daysBetween', () => {
  it('zählt beide Enden mit', () => {
    expect(daysBetween('2026-08-21', '2026-08-21')).toBe(1)
    expect(daysBetween('2026-08-21', '2026-08-23')).toBe(3)
  })

  it('zählt über eine Zeitumstellung hinweg richtig', () => {
    // Der 25.10.2026 hat 25 Stunden — ohne Rundung käme hier 4,04 heraus.
    expect(daysBetween('2026-10-24', '2026-10-27')).toBe(4)
  })

  it('zählt über einen Jahreswechsel', () => {
    expect(daysBetween('2025-12-30', '2026-01-02')).toBe(4)
  })
})

describe('windowStart / windowEnd', () => {
  it('beginnt drei Tage vor heute', () => {
    expect(windowStart(NOW)).toBe('2026-08-18')
    expect(DAYS_BEFORE_TODAY).toBe(3)
  })

  it('umfasst insgesamt zwölf Tage', () => {
    expect(daysBetween(windowStart(NOW), windowEnd(NOW))).toBe(WINDOW_DAYS)
    expect(WINDOW_DAYS).toBe(12)
  })

  it('reicht acht Tage in die Zukunft', () => {
    expect(windowEnd(NOW)).toBe('2026-08-29')
  })

  it('rutscht mit dem Datum mit', () => {
    const morgen = new Date(2026, 7, 22, 10, 0)
    expect(windowStart(morgen)).toBe('2026-08-19')
  })
})

describe('calendarRange', () => {
  it('reicht 30 Tage zurück und 120 voraus', () => {
    const { from, to } = calendarRange(NOW)
    expect(from).toBe('2026-07-22')
    expect(to).toBe('2026-12-19')
    expect(daysBetween(from, to)).toBe(
      CALENDAR_PAST_DAYS + CALENDAR_FUTURE_DAYS + 1,
    )
  })

  it('umschließt den Tag, auf den „Heute" springt', () => {
    // Ohne diese Zusicherung gäbe es die Zeile gar nicht, die der Knopf oben
    // ins Bild setzt — und er täte wieder nichts.
    const { from, to } = calendarRange(NOW)
    expect(from <= windowStart(NOW)).toBe(true)
    expect(windowEnd(NOW) <= to).toBe(true)
  })

  it('rutscht mit dem Datum mit', () => {
    expect(calendarRange(new Date(2026, 7, 22, 10, 0)).from).toBe('2026-07-23')
  })
})

describe('calendarDays', () => {
  const days = calendarDays(windowStart(NOW), windowEnd(NOW), NOW)

  it('liefert genau die Tage des Fensters', () => {
    expect(days).toHaveLength(12)
    expect(days[0].date).toBe('2026-08-18')
    expect(days[11].date).toBe('2026-08-29')
  })

  it('hat heute an vierter Stelle', () => {
    expect(days[3].date).toBe(TODAY)
    expect(days[3].isToday).toBe(true)
    expect(days.filter((day) => day.isToday)).toHaveLength(1)
  })

  it('markiert genau die drei Tage davor als vergangen', () => {
    expect(days.filter((day) => day.isPast).map((day) => day.date)).toEqual([
      '2026-08-18',
      '2026-08-19',
      '2026-08-20',
    ])
  })

  it('zählt heute nicht als vergangen', () => {
    expect(days[3].isPast).toBe(false)
  })

  it('benennt die Wochentage', () => {
    expect(days[3].weekdayLong).toBe('Freitag')
    expect(days[3].weekdayShort).toBe('Fr')
  })

  it('markiert Samstag und Sonntag als Wochenende', () => {
    // 18.08. (Di) bis 29.08. (Sa) enthält Sa/So am 22./23. und noch den 29.
    expect(days.filter((day) => day.isWeekend).map((day) => day.date)).toEqual([
      '2026-08-22',
      '2026-08-23',
      '2026-08-29',
    ])
  })

  it('markiert den Monatsersten für die Trennlinie', () => {
    const september = calendarDays('2026-08-30', '2026-09-02', NOW)
    expect(september.filter((day) => day.startsMonth).map((d) => d.date)).toEqual(
      ['2026-09-01'],
    )
  })

  it('kommt mit einem umgekehrten Bereich klar, statt zu entgleisen', () => {
    expect(calendarDays('2026-08-21', '2026-08-18', NOW)).toEqual([])
  })
})

describe('todayISO', () => {
  it('nennt den heutigen Tag', () => {
    expect(todayISO(NOW)).toBe(TODAY)
  })
})

describe('slotKey', () => {
  it('lässt sich wieder zerlegen', () => {
    const key = slotKey(TODAY, 'dinner')
    expect(key).toBe('2026-08-21_dinner')
    expect(parseSlotKey(key)).toEqual({ date: TODAY, meal: 'dinner' })
  })

  it('weist Unsinn zurück', () => {
    expect(parseSlotKey('quatsch')).toBeNull()
    expect(parseSlotKey('2026-08-26_brunch')).toBeNull()
  })

  it('sortiert sich als Text von selbst nach Datum', () => {
    // Darauf beruht die Bereichsabfrage in Firestore.
    const keys = [
      slotKey('2026-09-01', 'lunch'),
      slotKey('2026-08-21', 'dinner'),
      slotKey('2026-08-21', 'lunch'),
    ].sort()
    expect(keys).toEqual([
      '2026-08-21_dinner',
      '2026-08-21_lunch',
      '2026-09-01_lunch',
    ])
  })
})

describe('Beschriftungen', () => {
  it('formatiert einen Tag', () => {
    expect(formatDayShort(TODAY)).toBe('21.08.')
  })

  it('formatiert den Zeitraum der Einkaufsliste', () => {
    expect(formatRange(windowStart(NOW), windowEnd(NOW))).toBe(
      '18.08. – 29.08.2026',
    )
  })
})
