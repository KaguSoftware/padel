import type {
  AvailabilityException,
  AvailabilityTemplate,
  Court,
} from "@/data/types";
import {
  DAY_SPAN_HOURS,
  instantAt,
  type LocalDate,
  venueWeekday,
} from "@/lib/time";

/**
 * Availability is COMPUTED, never stored.
 *
 * Opening hours live in a weekly template; holidays, maintenance and Ramadan
 * hours are exception rows over a date range. Materialising every 90-minute
 * slot for a year would be a table to migrate every time the client touches
 * their hours, and they touch them every Ramadan at minimum.
 */

export interface OpenWindow {
  courtId: string;
  /** Minutes from the operating day's 06:00 start. */
  openMinute: number;
  closeMinute: number;
}

export interface ClosureNote {
  courtId: string;
  kind: AvailabilityException["kind"];
  note: string;
  noteAr: string;
}

export interface ResolvedAvailability {
  windows: OpenWindow[];
  closures: ClosureNote[];
}

const FULL_DAY_MINUTES = DAY_SPAN_HOURS * 60;

function coversDay(ex: AvailabilityException, day: LocalDate): boolean {
  return ex.from <= day && day <= ex.to;
}

/**
 * Resolve each court's open window for one operating day.
 *
 * Precedence, narrowest wins:
 *   1. court-specific exception
 *   2. venue-wide exception
 *   3. court-specific template
 *   4. venue-wide template
 *
 * An exception with null open/close closes the court entirely for the day.
 */
export function resolveAvailability(
  day: LocalDate,
  courts: Court[],
  templates: AvailabilityTemplate[],
  exceptions: AvailabilityException[],
): ResolvedAvailability {
  const weekday = venueWeekday(instantAt(day, 12 * 60));
  const windows: OpenWindow[] = [];
  const closures: ClosureNote[] = [];

  const applicable = exceptions.filter((ex) => coversDay(ex, day));

  for (const court of courts) {
    if (!court.active) {
      closures.push({
        courtId: court.id,
        kind: "maintenance",
        note: "Court inactive",
        noteAr: "الملعب غير مفعل",
      });
      continue;
    }

    const ex =
      applicable.find((e) => e.courtId === court.id) ??
      applicable.find((e) => e.courtId === null);

    if (ex) {
      if (ex.openMinute === null || ex.closeMinute === null) {
        closures.push({
          courtId: court.id,
          kind: ex.kind,
          note: ex.note,
          noteAr: ex.noteAr,
        });
        continue;
      }
      windows.push({
        courtId: court.id,
        openMinute: clampMinute(ex.openMinute),
        closeMinute: clampMinute(ex.closeMinute),
      });
      // Ramadan hours are a shortened window, not a closure — the note still
      // shows on the calendar so staff know why the page ends early.
      closures.push({
        courtId: court.id,
        kind: ex.kind,
        note: ex.note,
        noteAr: ex.noteAr,
      });
      continue;
    }

    const tpl =
      templates.find((t) => t.courtId === court.id && t.weekday === weekday) ??
      templates.find((t) => t.courtId === null && t.weekday === weekday);

    if (!tpl) {
      closures.push({
        courtId: court.id,
        kind: "holiday",
        note: "Closed",
        noteAr: "مغلق",
      });
      continue;
    }

    windows.push({
      courtId: court.id,
      openMinute: clampMinute(tpl.openMinute),
      closeMinute: clampMinute(tpl.closeMinute),
    });
  }

  return { windows, closures };
}

function clampMinute(m: number): number {
  return Math.max(0, Math.min(FULL_DAY_MINUTES, m));
}

/** Is a court open across the whole requested interval? */
export function isOpenFor(
  availability: ResolvedAvailability,
  courtId: string,
  fromMinute: number,
  toMinute: number,
): boolean {
  const w = availability.windows.find((x) => x.courtId === courtId);
  if (!w) return false;
  return fromMinute >= w.openMinute && toMinute <= w.closeMinute;
}
