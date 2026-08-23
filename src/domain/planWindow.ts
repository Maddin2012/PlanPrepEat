import type { ISODate, Meal } from './types.ts'

/**
 * Der Essensplan ist ein fortlaufender Kalender ohne feste Zeiträume.
 *
 * Gezeigt werden zunächst 12 Tage, beginnend **drei Tage vor heute**. Die
 * vergangenen Tage sind bewusst dabei: Wenn ein Tag anders lief als gedacht,
 * lässt sich das Gericht von dort noch auf einen späteren Tag schieben.
 */
export const DAYS_BEFORE_TODAY = 3

/** Anzahl der Tage, die beim Öffnen im Blick sind. */
export const WINDOW_DAYS = 12

/** Wie viele Tage beim Scrollen jeweils nachgeladen werden. */
export const PAGE_DAYS = 7

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

/** Der erste Tag des Fensters: drei Tage vor heute. */
export function windowStart(now: Date = new Date()): ISODate {
  return addDays(todayISO(now), -DAYS_BEFORE_TODAY)
}

/** Der letzte Tag des Fensters. */
export function windowEnd(now: Date = new Date()): ISODate {
  return addDays(windowStart(now), WINDOW_DAYS - 1)
}

/** Anzahl der Tage von `from` bis `to`, beide eingeschlossen. */
export function daysBetween(from: ISODate, to: ISODate): number {
  const ms = fromISODate(to).getTime() - fromISODate(from).getTime()
  // Über eine Zeitumstellung hinweg hat ein Tag 23 oder 25 Stunden. Runden
  // fängt das ab, ohne dass wir Tag für Tag hochzählen müssen.
  return Math.round(ms / 86_400_000) + 1
}

export interface CalendarDay {
  date: ISODate
  /** 0 = Sonntag … 6 = Samstag */
  weekday: number
  weekdayShort: string
  weekdayLong: string
  /** „26.08." */
  dayLabel: string
  isToday: boolean
  /** Liegt hinter uns — wird gedämpft dargestellt. */
  isPast: boolean
  isWeekend: boolean
  /** true am ersten Tag eines Monats, für eine Trennlinie im Raster. */
  startsMonth: boolean
}

/** Die Tage von `from` bis `to`, fertig aufbereitet für die Anzeige. */
export function calendarDays(
  from: ISODate,
  to: ISODate,
  now: Date = new Date(),
): CalendarDay[] {
  const today = todayISO(now)
  const count = Math.max(0, daysBetween(from, to))

  return Array.from({ length: count }, (_, offset) => {
    const date = addDays(from, offset)
    const parsed = fromISODate(date)
    const weekday = parsed.getDay()

    return {
      date,
      weekday,
      weekdayShort: WEEKDAY_SHORT[weekday],
      weekdayLong: WEEKDAY_LONG[weekday],
      dayLabel: formatDayShort(date),
      isToday: date === today,
      isPast: date < today,
      isWeekend: weekday === 0 || weekday === 6,
      startsMonth: parsed.getDate() === 1,
    }
  })
}

/** „26.08." */
export function formatDayShort(iso: ISODate): string {
  const date = fromISODate(iso)
  return `${String(date.getDate()).padStart(2, '0')}.${String(
    date.getMonth() + 1,
  ).padStart(2, '0')}.`
}

/** „26.08. – 06.09.2026", für die Kopfzeile der Einkaufsliste. */
export function formatRange(from: ISODate, to: ISODate): string {
  return `${formatDayShort(from)} – ${formatDayShort(to)}${fromISODate(
    to,
  ).getFullYear()}`
}

/** „August 2026", als Trennlinie zwischen zwei Monaten im Kalender. */
export function formatMonth(iso: ISODate): string {
  return fromISODate(iso).toLocaleDateString('de-DE', {
    month: 'long',
    year: 'numeric',
  })
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
