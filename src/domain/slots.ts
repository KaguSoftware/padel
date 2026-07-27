import type { Booking, Court } from "@/data/types";
import { OCCUPYING_STATUSES } from "@/data/types";
import { instantAt, type LocalDate, minutesIntoDay, overlaps } from "@/lib/time";
import type { ResolvedAvailability } from "./availability";

/**
 * The slot grid, generated on read.
 *
 * The calendar draws from `DayGrid`; the player app draws from the same
 * function with a different `durations` filter. There is exactly one place that
 * decides whether a slot is free.
 */

export const DEFAULT_DURATIONS = [60, 90, 120] as const;
/** The grid's row resolution. Bookings snap to this. */
export const SLOT_STEP_MINUTES = 30;

export type SlotState = "open" | "occupied" | "closed" | "past";

export interface Slot {
  courtId: string;
  /** Minutes from 06:00. */
  startMinute: number;
  durationMinutes: number;
  state: SlotState;
  /** Set when `state === "occupied"`. */
  bookingId: string | null;
}

export interface DayGrid {
  day: LocalDate;
  courts: Court[];
  /** Row headings, minutes from 06:00, ascending. */
  rowMinutes: number[];
  /** Keyed `${courtId}:${startMinute}` for O(1) cell lookup during render. */
  cells: Map<string, Slot>;
  /** Bookings that occupy the day, in start order. */
  bookings: Booking[];
}

export function cellKey(courtId: string, startMinute: number): string {
  return `${courtId}:${startMinute}`;
}

interface GridInput {
  day: LocalDate;
  courts: Court[];
  availability: ResolvedAvailability;
  bookings: Booking[];
  now?: Date;
}

/**
 * Build the whole day's grid in one pass.
 *
 * Pure and allocation-conscious: this runs on every calendar render and on the
 * server for every availability read, so it does no I/O and no date parsing
 * beyond the day's two boundary instants.
 */
export function computeDayGrid({
  day,
  courts,
  availability,
  bookings,
  now = new Date(),
}: GridInput): DayGrid {
  const occupying = bookings
    .filter((b) => OCCUPYING_STATUSES.includes(b.status))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const bounds = windowBounds(availability);
  const rowMinutes: number[] = [];
  for (let m = bounds.from; m < bounds.to; m += SLOT_STEP_MINUTES) {
    rowMinutes.push(m);
  }

  const nowMinute = minutesIntoDay(now, day);
  const cells = new Map<string, Slot>();

  for (const court of courts) {
    const w = availability.windows.find((x) => x.courtId === court.id);
    const courtBookings = occupying.filter((b) => b.courtId === court.id);

    for (const startMinute of rowMinutes) {
      const endMinute = startMinute + SLOT_STEP_MINUTES;
      let state: SlotState = "open";
      let bookingId: string | null = null;

      if (!w || startMinute < w.openMinute || endMinute > w.closeMinute) {
        state = "closed";
      } else {
        const cellStart = instantAt(day, startMinute);
        const cellEnd = instantAt(day, endMinute);
        const hit = courtBookings.find((b) =>
          overlaps(b.start, b.end, cellStart, cellEnd),
        );
        if (hit) {
          state = "occupied";
          bookingId = hit.id;
        } else if (endMinute <= nowMinute) {
          state = "past";
        }
      }

      cells.set(cellKey(court.id, startMinute), {
        courtId: court.id,
        startMinute,
        durationMinutes: SLOT_STEP_MINUTES,
        state,
        bookingId,
      });
    }
  }

  return { day, courts, rowMinutes, cells, bookings: occupying };
}

function windowBounds(a: ResolvedAvailability): { from: number; to: number } {
  if (a.windows.length === 0) return { from: 0, to: 0 };
  let from = Number.POSITIVE_INFINITY;
  let to = 0;
  for (const w of a.windows) {
    if (w.openMinute < from) from = w.openMinute;
    if (w.closeMinute > to) to = w.closeMinute;
  }
  return { from: from === Number.POSITIVE_INFINITY ? 0 : from, to };
}

/**
 * Bookable start times for a given duration — what the player app lists.
 *
 * A start is bookable when every 30-minute cell it spans is `open`. Past cells
 * are excluded, which is why the grid distinguishes `past` from `open` rather
 * than collapsing both to "not bookable": the console still needs to render and
 * edit this morning's entries.
 */
export function bookableStarts(
  grid: DayGrid,
  courtId: string,
  durationMinutes: number,
): number[] {
  const span = durationMinutes / SLOT_STEP_MINUTES;
  const out: number[] = [];

  for (const startMinute of grid.rowMinutes) {
    let ok = true;
    for (let i = 0; i < span; i++) {
      const cell = grid.cells.get(
        cellKey(courtId, startMinute + i * SLOT_STEP_MINUTES),
      );
      if (!cell || cell.state !== "open") {
        ok = false;
        break;
      }
    }
    if (ok) out.push(startMinute);
  }
  return out;
}

/** Every court's bookable starts for a duration, for the player app's day view. */
export function bookableByCourt(
  grid: DayGrid,
  durationMinutes: number,
): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const court of grid.courts) {
    out.set(court.id, bookableStarts(grid, court.id, durationMinutes));
  }
  return out;
}

/** Utilisation of the day: occupied cell-minutes over open cell-minutes. */
export function utilisation(grid: DayGrid): number {
  let open = 0;
  let taken = 0;
  for (const cell of grid.cells.values()) {
    if (cell.state === "closed") continue;
    open += cell.durationMinutes;
    if (cell.state === "occupied") taken += cell.durationMinutes;
  }
  return open === 0 ? 0 : taken / open;
}

/** Per-hour utilisation — the owner's single most important number. */
export function utilisationByHour(grid: DayGrid): Map<number, number> {
  const open = new Map<number, number>();
  const taken = new Map<number, number>();

  for (const cell of grid.cells.values()) {
    if (cell.state === "closed") continue;
    const hour = Math.floor(cell.startMinute / 60);
    open.set(hour, (open.get(hour) ?? 0) + cell.durationMinutes);
    if (cell.state === "occupied") {
      taken.set(hour, (taken.get(hour) ?? 0) + cell.durationMinutes);
    }
  }

  const out = new Map<number, number>();
  for (const [hour, o] of open) {
    out.set(hour, o === 0 ? 0 : (taken.get(hour) ?? 0) / o);
  }
  return out;
}
