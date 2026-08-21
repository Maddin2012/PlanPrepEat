import { describe, expect, it } from 'vitest'
import {
  PLAN_LENGTH_DAYS,
  addDays,
  formatPlanRange,
  fromISODate,
  isWednesday,
  isWithinPlan,
  mostRecentWednesday,
  nextWednesday,
  parseSlotKey,
  planDays,
  planEndDate,
  slotKey,
  suggestNextStart,
  toISODate,
} from './planWindow.ts'

// 2026-08-26 ist ein Mittwoch.
const WEDNESDAY = '2026-08-26'

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

describe('mostRecentWednesday', () => {
  it('gibt an einem Mittwoch denselben Tag zurück', () => {
    expect(mostRecentWednesday(WEDNESDAY)).toBe(WEDNESDAY)
  })

  it('geht von Donnerstag einen Tag zurück', () => {
    expect(mostRecentWednesday('2026-08-27')).toBe(WEDNESDAY)
  })

  it('geht von Dienstag sechs Tage zurück', () => {
    expect(mostRecentWednesday('2026-09-01')).toBe(WEDNESDAY)
  })

  it('landet von jedem Wochentag aus auf einem Mittwoch', () => {
    for (let offset = 0; offset < 7; offset += 1) {
      expect(isWednesday(mostRecentWednesday(addDays(WEDNESDAY, offset)))).toBe(
        true,
      )
    }
  })
})

describe('nextWednesday', () => {
  it('springt vom Mittwoch eine volle Woche weiter', () => {
    expect(nextWednesday(WEDNESDAY)).toBe('2026-09-02')
  })

  it('springt vom Donnerstag auf den Mittwoch danach', () => {
    expect(nextWednesday('2026-08-27')).toBe('2026-09-02')
  })
})

describe('planDays', () => {
  const days = planDays(WEDNESDAY, new Date(2026, 7, 28))

  it('umfasst 12 Tage', () => {
    expect(days).toHaveLength(PLAN_LENGTH_DAYS)
    expect(PLAN_LENGTH_DAYS).toBe(12)
  })

  it('beginnt am Mittwoch und endet am Sonntag der Folgewoche', () => {
    expect(days[0].weekdayLong).toBe('Mittwoch')
    expect(days[0].date).toBe(WEDNESDAY)
    expect(days[11].weekdayLong).toBe('Sonntag')
    expect(days[11].date).toBe('2026-09-06')
  })

  it('enthält jeden Wochentag mindestens einmal', () => {
    expect(new Set(days.map((day) => day.weekday)).size).toBe(7)
  })

  it('markiert den heutigen Tag', () => {
    expect(days.filter((day) => day.isToday).map((day) => day.date)).toEqual([
      '2026-08-28',
    ])
  })

  it('markiert den Beginn der zweiten Woche am Montag', () => {
    const second = days.find((day) => day.startsSecondWeek)
    expect(second?.weekdayLong).toBe('Montag')
  })

  it('markiert Samstag und Sonntag als Wochenende', () => {
    expect(days.filter((day) => day.isWeekend)).toHaveLength(4)
  })
})

describe('planEndDate / isWithinPlan', () => {
  it('endet elf Tage nach dem Start', () => {
    expect(planEndDate(WEDNESDAY)).toBe('2026-09-06')
  })

  it('erkennt Tage innerhalb und außerhalb des Zeitraums', () => {
    expect(isWithinPlan(WEDNESDAY, WEDNESDAY)).toBe(true)
    expect(isWithinPlan(WEDNESDAY, '2026-09-06')).toBe(true)
    expect(isWithinPlan(WEDNESDAY, '2026-08-25')).toBe(false)
    expect(isWithinPlan(WEDNESDAY, '2026-09-07')).toBe(false)
  })
})

describe('suggestNextStart', () => {
  it('schlägt ohne Vorgänger den zuletzt vergangenen Mittwoch vor', () => {
    expect(suggestNextStart(null, new Date(2026, 7, 28))).toBe(WEDNESDAY)
  })

  it('schlägt sonst den Mittwoch eine Woche später vor', () => {
    const next = suggestNextStart(WEDNESDAY)
    expect(next).toBe('2026-09-02')
    expect(isWednesday(next)).toBe(true)
  })
})

describe('slotKey', () => {
  it('lässt sich wieder zerlegen', () => {
    const key = slotKey(WEDNESDAY, 'dinner')
    expect(key).toBe('2026-08-26_dinner')
    expect(parseSlotKey(key)).toEqual({ date: WEDNESDAY, meal: 'dinner' })
  })

  it('weist Unsinn zurück', () => {
    expect(parseSlotKey('quatsch')).toBeNull()
    expect(parseSlotKey('2026-08-26_brunch')).toBeNull()
  })
})

describe('formatPlanRange', () => {
  it('nennt Wochentag und Datum von Anfang und Ende', () => {
    expect(formatPlanRange(WEDNESDAY)).toBe('Mi, 26.08. – So, 06.09.2026')
  })
})
