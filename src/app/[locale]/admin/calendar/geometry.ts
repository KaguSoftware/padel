/**
 * THE BOARD'S ARITHMETIC.
 *
 * Everything on the day board resolves through this file: where a card starts,
 * how wide it is, which band a finger landed on, whether a duration fits. It is
 * pure and has no React in it, so it can be tested directly — the previous
 * board had this arithmetic inlined across two components (including one
 * verbatim copy of `clockOf`) and none of it was reachable by a test.
 *
 * All minutes in this system are minutes-from-06:00, because the operating day
 * runs 06:00 → 02:00 and a 01:00 booking belongs to the previous day's board.
 */

import { SLOT_STEP_MINUTES } from "@/domain/slots";

/** Minutes-from-06:00 rendered as a wall clock, past midnight included. */
export function clockOf(minute: number): string {
  const h = Math.floor((minute + 6 * 60) / 60) % 24;
  const m = ((minute % 60) + 60) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** The hour label alone — "21", for the axis, where ":00" is noise on every tick. */
export function hourOf(minute: number): string {
  return String(Math.floor((minute + 6 * 60) / 60) % 24).padStart(2, "0");
}

export function isOnHour(minute: number): boolean {
  return ((minute % 60) + 60) % 60 === 0;
}

/**
 * Distance along the lane, in bands, as a CSS length.
 *
 * `--slot-w` is one 30-minute band and the single source of truth for the
 * ruling AND for every card's offset and width, so a 19:30 card cannot land
 * two pixels off the 19:30 rule.
 */
export function bandSpan(bands: number): string {
  return `calc(var(--slot-w) * ${bands})`;
}

export function bandsBetween(fromMinute: number, toMinute: number, step: number): number {
  return (toMinute - fromMinute) / step;
}

/** Where a card sits in its lane, and how wide it is. */
export function cardGeometry(
  startMinute: number,
  durationMinutes: number,
  firstMinute: number,
  step: number,
): { insetInlineStart: string; width: string } {
  return {
    insetInlineStart: bandSpan(bandsBetween(firstMinute, startMinute, step)),
    // A card is never narrower than a thumb, even at the 30-minute minimum.
    width: `max(${bandSpan(durationMinutes / step)}, 2.75rem)`,
  };
}

/** Snap a raw minute onto the grid's resolution, clamped to the day's window. */
export function snapMinute(
  minute: number,
  step: number,
  firstMinute: number,
  lastMinute: number,
): number {
  const snapped = Math.round((minute - firstMinute) / step) * step + firstMinute;
  return Math.min(Math.max(snapped, firstMinute), lastMinute - step);
}

/**
 * The nearest legal duration to a dragged width.
 *
 * The club sells 60, 90 and 120. A resize that lands on 45 is not a shorter
 * booking, it is a booking the pricing engine cannot quote — so the handle
 * snaps to what can actually be sold rather than to the grid.
 */
export function snapDuration(
  rawMinutes: number,
  durations: readonly number[],
): number {
  let best = durations[0];
  let bestGap = Number.POSITIVE_INFINITY;
  for (const d of durations) {
    const gap = Math.abs(d - rawMinutes);
    if (gap < bestGap) {
      bestGap = gap;
      best = d;
    }
  }
  return best;
}

/**
 * Contiguous closed stretches per court, from the grid's per-cell states.
 *
 * The old board asked one question per COLUMN — "does this court have any open
 * cell today?" — and hatched the whole column or none of it. A court on a
 * shortened Ramadan window, or closed for a two-hour maintenance block, drew as
 * fully open on a board whose server would reject every write into it. The grid
 * has always known the truth per cell; it just never crossed to the client.
 *
 * Runs are sent instead of cells because a 5-court, 40-band day is 200 entries
 * and roughly four runs.
 */
export interface ClosedRun {
  fromMinute: number;
  /** Exclusive. */
  toMinute: number;
}

export function runsFromClosedMinutes(
  closedMinutes: readonly number[],
  step: number,
): ClosedRun[] {
  const sorted = [...closedMinutes].sort((a, b) => a - b);
  const runs: ClosedRun[] = [];

  for (const minute of sorted) {
    const last = runs[runs.length - 1];
    if (last && last.toMinute === minute) {
      last.toMinute = minute + step;
    } else {
      runs.push({ fromMinute: minute, toMinute: minute + step });
    }
  }
  return runs;
}

export function isClosedAt(runs: readonly ClosedRun[], minute: number): boolean {
  return runs.some((r) => minute >= r.fromMinute && minute < r.toMinute);
}

/**
 * Does a booking of this length fit here?
 *
 * Checked against occupancy AND closure, band by band, because a 120-minute
 * booking that starts in an open band can still run into a maintenance block or
 * past closing.
 */
export function spanIsFree({
  courtId,
  startMinute,
  durationMinutes,
  step,
  occupied,
  closedByCourt,
  lastMinute,
  ignoreBookingId,
  occupantAt,
}: {
  courtId: string;
  startMinute: number;
  durationMinutes: number;
  step: number;
  occupied: ReadonlySet<string>;
  closedByCourt: ReadonlyMap<string, ClosedRun[]>;
  lastMinute: number;
  /** The card being moved does not collide with where it currently is. */
  ignoreBookingId?: string;
  occupantAt?: (courtId: string, minute: number) => string | undefined;
}): boolean {
  if (startMinute + durationMinutes > lastMinute) return false;

  const closed = closedByCourt.get(courtId) ?? [];
  for (let m = startMinute; m < startMinute + durationMinutes; m += step) {
    if (isClosedAt(closed, m)) return false;
    if (occupied.has(`${courtId}:${m}`)) {
      if (!ignoreBookingId) return false;
      if (occupantAt?.(courtId, m) !== ignoreBookingId) return false;
    }
  }
  return true;
}

/**
 * Where "now" falls, in minutes-from-06:00, for a wall-clock instant.
 *
 * Exported so the board's now-line and its tests agree on the one conversion.
 * A negative result means the instant is after midnight but before 06:00, which
 * still belongs to the previous operating day — hence the wrap rather than a
 * clamp to zero.
 */
export function minuteOfDayInVenue(now: number, timeZone: string): number {
  const local = new Date(new Date(now).toLocaleString("en-US", { timeZone }));
  const raw = local.getHours() * 60 + local.getMinutes() - 6 * 60;
  return raw < 0 ? raw + 24 * 60 : raw;
}

/** The hour ticks the axis prints, derived from the day's own window. */
export function hourTicks(rowMinutes: readonly number[]): number[] {
  return rowMinutes.filter(isOnHour);
}

export { SLOT_STEP_MINUTES };
