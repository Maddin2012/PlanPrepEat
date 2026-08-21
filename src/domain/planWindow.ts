import type { ISODate, Meal } from './types.ts'

/**
 * Ein Planungszeitraum läuft von Mittwoch bis zum Sonntag der Folgewoche:
 * Mi Do Fr Sa So + Mo Di Mi Do Fr Sa So = 12 Tage.
 */
export const PLAN_LENGTH_DAYS = 12

/** Date#getDay(): Sonntag = 0, Mittwoch = 3. */
const WEDNESDAY = 3

export const WEEKDAY_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const
export const WEEKDAY_LONG = [
  'Sonntag',
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
] as const

export const MEALS: Meal[] = ['lunch', 'dinner']

export const MEAL_LABELS: Record<Meal, string> = {
  lunch: 'Mittagessen',
  dinner: 'Abendbrot',
}

/**
 * Wandelt ein Date in ein ISO-Datum um — bewusst über die lokalen Getter und
 * nicht über toISOString(), das nach UTC umrechnet und je nach Uhrzeit und
 * Zeitzone einen Tag danebenliegt.
 */
export function toISODate(date: Date): ISODate {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Liest ein ISO-Datum als lokale Mitternacht ein. */
export function fromISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

/** Verschiebt ein ISO-Datum um `days` Tage. */
export function addDays(iso: ISODate, days: number): ISODate {
  const date = fromISODate(iso)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISODate(now)
}

/** Der Mittwoch am oder vor dem übergebenen Datum. */
export function mostRecentWednesday(iso: ISODate): ISODate {
  const back = (fromISODate(iso).getDay() - WEDNESDAY + 7) % 7
  return addDays(iso, -back)
}

/** Der nächste Mittwoch *nach* dem übergebenen Datum (nie derselbe Tag). */
export function nextWednesday(iso: ISODate): ISODate {
  const forward = (WEDNESDAY - fromISODate(iso).getDay() + 7) % 7
  return addDays(iso, forward === 0 ? 7 : forward)
}

export function isWednesday(iso: ISODate): boolean {
  return fromISODate(iso).getDay() === WEDNESDAY
}

/**
 * Der Startvorschlag für einen neuen Zeitraum: eine Woche nach dem letzten
 * Plan. Die Zeiträume überlappen sich damit um fünf Tage — das ist so gewollt,
 * weil jeden Mittwoch neu eingekauft wird und die zweite Wochenhälfte beim
 * Einkauf am Folgemittwoch ohnehin noch einmal auf den Tisch kommt.
 */
export function suggestNextStart(
  lastStart: ISODate | null,
  now: Date = new Date(),
): ISODate {
  if (!lastStart) return mostRecentWednesday(todayISO(now))
  return addDays(lastStart, 7)
}

export interface PlanDay {
  date: ISODate
  /** 0 = Sonntag … 6 = Samstag */
  weekday: number
  weekdayShort: string
  weekdayLong: string
  /** „26.08." */
  dayLabel: string
  isToday: boolean
  isWeekend: boolean
  /** true ab dem zweiten Kalendermittwoch, für die Trennlinie im Raster. */
  startsSecondWeek: boolean
}

/** Die 12 Tage eines Zeitraums, fertig aufbereitet für die Anzeige. */
export function planDays(
  startDate: ISODate,
  now: Date = new Date(),
): PlanDay[] {
  const today = todayISO(now)
  return Array.from({ length: PLAN_LENGTH_DAYS }, (_, offset) => {
    const date = addDays(startDate, offset)
    const weekday = fromISODate(date).getDay()
    return {
      date,
      weekday,
      weekdayShort: WEEKDAY_SHORT[weekday],
      weekdayLong: WEEKDAY_LONG[weekday],
      dayLabel: formatDayShort(date),
      isToday: date === today,
      isWeekend: weekday === 0 || weekday === 6,
      startsSecondWeek: offset === 5,
    }
  })
}

/** Der letzte Tag eines Zeitraums (der Sonntag). */
export function planEndDate(startDate: ISODate): ISODate {
  return addDays(startDate, PLAN_LENGTH_DAYS - 1)
}

/** Liegt `date` innerhalb des Zeitraums? */
export function isWithinPlan(startDate: ISODate, date: ISODate): boolean {
  return date >= startDate && date <= planEndDate(startDate)
}

/** „26.08." */
export function formatDayShort(iso: ISODate): string {
  const date = fromISODate(iso)
  return `${String(date.getDate()).padStart(2, '0')}.${String(
    date.getMonth() + 1,
  ).padStart(2, '0')}.`
}

/** „Mi, 26.08. – So, 06.09.2026" */
export function formatPlanRange(startDate: ISODate): string {
  const end = planEndDate(startDate)
  const startDay = fromISODate(startDate)
  const endDay = fromISODate(end)
  return `${WEEKDAY_SHORT[startDay.getDay()]}, ${formatDayShort(startDate)} – ${
    WEEKDAY_SHORT[endDay.getDay()]
  }, ${formatDayShort(end)}${endDay.getFullYear()}`
}

/** Schlüssel eines Mahlzeiten-Platzes, zugleich die Firestore-Dokument-ID. */
export function slotKey(date: ISODate, meal: Meal): string {
  return `${date}_${meal}`
}

export function parseSlotKey(key: string): { date: ISODate; meal: Meal } | null {
  const match = /^(\d{4}-\d{2}-\d{2})_(lunch|dinner)$/.exec(key)
  if (!match) return null
  return { date: match[1], meal: match[2] as Meal }
}
