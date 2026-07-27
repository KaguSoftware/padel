import { TZDate } from "@date-fns/tz";
import { addMinutes, differenceInMinutes, format, parseISO } from "date-fns";

/**
 * The club runs on Asia/Dubai and the operating day runs 06:00 -> 02:00, so a
 * booking at 01:00 belongs to the PREVIOUS day's page and the previous day's
 * till. `operatingDayOf` owns that rule; nothing else recomputes it.
 *
 * `new Date().toISOString().slice(0,10)` is UTC and answers *yesterday* between
 * 00:00 and 04:00 local. It is never correct for a domain date here.
 */

export const VENUE_TZ = "Asia/Dubai";

/** The hour the operating day begins, local. Bookings before it belong to the previous page. */
export const DAY_START_HOUR = 6;

/** How many hours the operating day spans. 06:00 -> 02:00 next day = 20 hours. */
export const DAY_SPAN_HOURS = 20;

/** `YYYY-MM-DD` in venue-local terms. The key every day-scoped query uses. */
export type LocalDate = string & { readonly __localDate: unique symbol };

export function localDate(value: string): LocalDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Not a YYYY-MM-DD local date: ${value}`);
  }
  return value as LocalDate;
}

function inVenue(instant: Date): TZDate {
  return new TZDate(instant, VENUE_TZ);
}

/** Today's operating day in Dubai. Never use the runtime clock's calendar date. */
export function todayInDubai(now: Date = new Date()): LocalDate {
  return operatingDayOf(now);
}

/**
 * Which operating day an instant belongs to. An instant before 06:00 local is
 * still the previous day's business.
 */
export function operatingDayOf(instant: Date): LocalDate {
  const z = inVenue(instant);
  const shifted = z.getHours() < DAY_START_HOUR ? addDaysLocal(z, -1) : z;
  return localDate(format(shifted, "yyyy-MM-dd"));
}

function addDaysLocal(d: TZDate, days: number): TZDate {
  const copy = new TZDate(d.getTime(), VENUE_TZ);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** The UTC instant of `HH:mm` on an operating day, resolving past-midnight hours. */
export function instantAt(day: LocalDate, minutesFromDayStart: number): Date {
  const [y, m, d] = day.split("-").map(Number);
  const base = new TZDate(y, m - 1, d, DAY_START_HOUR, 0, 0, 0, VENUE_TZ);
  return new Date(addMinutes(base, minutesFromDayStart).getTime());
}

/** Minutes elapsed since the operating day's 06:00 start. Can exceed 1080 for past-midnight slots. */
export function minutesIntoDay(instant: Date, day: LocalDate): number {
  return differenceInMinutes(instant, instantAt(day, 0));
}

/** The operating day's window as UTC instants, inclusive of past-midnight hours. */
export function dayWindow(day: LocalDate): { start: Date; end: Date } {
  return { start: instantAt(day, 0), end: instantAt(day, DAY_SPAN_HOURS * 60) };
}

/** Venue-local clock time, e.g. "21:30". Latin digits — this is a ledger column. */
export function clock(instant: Date): string {
  return format(inVenue(instant), "HH:mm");
}

/** Day of week in venue-local terms. 0 = Sunday, matching the pricing rule rows. */
export function venueWeekday(instant: Date): number {
  return inVenue(instant).getDay();
}

export function addDaysToLocalDate(day: LocalDate, days: number): LocalDate {
  const [y, m, d] = day.split("-").map(Number);
  const z = new TZDate(y, m - 1, d, 12, 0, 0, 0, VENUE_TZ);
  return localDate(format(addDaysLocal(z, days), "yyyy-MM-dd"));
}

export function parseInstant(iso: string): Date {
  return parseISO(iso);
}

/** Half-open interval overlap — the JS mirror of Postgres `tstzrange &&`. */
export function overlaps(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Whole minutes between two instants. */
export function durationMinutes(start: Date, end: Date): number {
  return differenceInMinutes(end, start);
}
