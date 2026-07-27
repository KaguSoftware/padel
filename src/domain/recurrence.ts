import type { BookingSeries, SeriesException } from "@/data/types";
import type { Fils } from "@/lib/money";
import {
  addDaysToLocalDate,
  instantAt,
  type LocalDate,
  venueWeekday,
} from "@/lib/time";

/**
 * Recurring bookings are first-class.
 *
 * A large share of the club's revenue is the same four players at 21:00 every
 * Tuesday for a year. A series carries the rule; instances are materialised
 * forward on a rolling window; per-instance exceptions handle "skip next week,
 * we're travelling" without breaking the series.
 *
 * Retrofitting this shape onto single bookings later is genuinely painful,
 * which is why it exists before the first screen does.
 */

/** How far ahead the sweep keeps instances materialised. */
export const MATERIALISE_WINDOW_DAYS = 56;

export interface PlannedInstance {
  seriesId: string;
  day: LocalDate;
  courtId: string;
  start: Date;
  end: Date;
  partySize: number;
  customerId: string;
  /** Set when an exception moved or repriced this instance. */
  overrideTotal: Fils | null;
  movedFrom: { courtId: string; start: Date } | null;
}

/**
 * Expand a series across a date range, applying exceptions.
 *
 * Skipped days produce nothing. Moved days produce an instance at the new
 * court/time, still attributed to the series so the customer's history reads as
 * one commitment rather than a gap plus an unrelated booking.
 */
export function expandSeries(
  series: BookingSeries,
  from: LocalDate,
  to: LocalDate,
  exceptions: SeriesException[],
): PlannedInstance[] {
  if (!series.active) return [];

  const out: PlannedInstance[] = [];
  const start = maxDate(from, series.from);
  const end = series.until ? minDate(to, series.until) : to;
  if (start > end) return [];

  const byDay = new Map<LocalDate, SeriesException>();
  for (const ex of exceptions) {
    if (ex.seriesId === series.id) byDay.set(ex.day, ex);
  }

  let day = start;
  // Walk forward to the first matching weekday rather than testing all 365.
  let guard = 0;
  while (day <= end && guard++ < 400) {
    const wd = venueWeekday(instantAt(day, series.startMinute));
    if (wd !== series.weekday) {
      day = addDaysToLocalDate(day, 1);
      continue;
    }

    const ex = byDay.get(day);
    if (ex?.kind === "skip") {
      day = addDaysToLocalDate(day, 7);
      continue;
    }

    const plannedStart = instantAt(day, series.startMinute);
    const instance: PlannedInstance = {
      seriesId: series.id,
      day,
      courtId: series.courtId,
      start: plannedStart,
      end: new Date(plannedStart.getTime() + series.durationMinutes * 60_000),
      partySize: series.partySize,
      customerId: series.customerId,
      overrideTotal: null,
      movedFrom: null,
    };

    if (ex?.kind === "move" && ex.movedToStart) {
      instance.movedFrom = { courtId: instance.courtId, start: instance.start };
      instance.courtId = ex.movedToCourtId ?? instance.courtId;
      instance.start = ex.movedToStart;
      instance.end = new Date(
        ex.movedToStart.getTime() + series.durationMinutes * 60_000,
      );
    }

    if (ex?.kind === "price" && ex.overrideTotal !== null) {
      instance.overrideTotal = ex.overrideTotal;
    }

    out.push(instance);
    day = addDaysToLocalDate(day, 7);
  }

  return out;
}

/**
 * What the rolling-window sweep should create.
 *
 * Instances that already exist are left alone, so the sweep is idempotent —
 * running it twice must insert nothing the second time. A sweep that is not
 * idempotent will duplicate every Tuesday 21:00 in the club within a week.
 */
export function instancesToMaterialise(
  planned: PlannedInstance[],
  existing: { seriesId: string | null; operatingDay: LocalDate }[],
): PlannedInstance[] {
  const have = new Set(
    existing
      .filter((b) => b.seriesId !== null)
      .map((b) => `${b.seriesId}:${b.operatingDay}`),
  );
  return planned.filter((p) => !have.has(`${p.seriesId}:${p.day}`));
}

/** The window the sweep materialises: today through today + 56 days. */
export function materialisationWindow(today: LocalDate): {
  from: LocalDate;
  to: LocalDate;
} {
  return { from: today, to: addDaysToLocalDate(today, MATERIALISE_WINDOW_DAYS) };
}

function maxDate(a: LocalDate, b: LocalDate): LocalDate {
  return a > b ? a : b;
}
function minDate(a: LocalDate, b: LocalDate): LocalDate {
  return a < b ? a : b;
}
