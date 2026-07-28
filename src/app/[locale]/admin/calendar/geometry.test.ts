import { describe, expect, it } from "vitest";
import {
  clockOf,
  hourOf,
  isClosedAt,
  isOnHour,
  minuteOfDayInVenue,
  runsFromClosedMinutes,
  snapDuration,
  snapMinute,
  spanIsFree,
} from "./geometry";

/**
 * The board's arithmetic, tested directly.
 *
 * On the previous board this maths lived inlined across two components — one of
 * them holding a verbatim copy of `clockOf` — and none of it was reachable by a
 * test. Every regression it produced (a card two pixels off its rule, a court
 * that hatched entirely because one band was closed) was found by eye.
 */

const STEP = 30;

describe("the clock", () => {
  it("reads minutes-from-06:00 as a wall clock", () => {
    expect(clockOf(0)).toBe("06:00");
    expect(clockOf(30)).toBe("06:30");
    expect(clockOf(13 * 60)).toBe("19:00");
  });

  it("crosses midnight, because the operating day does", () => {
    // 06:00 + 18h = midnight; the day runs to 02:00.
    expect(clockOf(18 * 60)).toBe("00:00");
    expect(clockOf(19 * 60 + 30)).toBe("01:30");
  });

  it("prints the bare hour for the axis", () => {
    expect(hourOf(13 * 60)).toBe("19");
    expect(hourOf(18 * 60)).toBe("00");
  });

  it("knows an hour from a half hour", () => {
    expect(isOnHour(0)).toBe(true);
    expect(isOnHour(30)).toBe(false);
    expect(isOnHour(120)).toBe(true);
  });
});

describe("snapping", () => {
  it("puts a raw minute on the nearest band", () => {
    expect(snapMinute(37, STEP, 0, 1200)).toBe(30);
    expect(snapMinute(46, STEP, 0, 1200)).toBe(60);
  });

  it("never lands past the end of the day", () => {
    expect(snapMinute(5000, STEP, 0, 1200)).toBe(1170);
  });

  it("never lands before the day opens", () => {
    expect(snapMinute(-90, STEP, 0, 1200)).toBe(0);
  });

  it("snaps a dragged length to something the club can sell", () => {
    // 45 minutes is not a shorter booking, it is a booking the pricing engine
    // cannot quote — so the handle lands on a real duration, not on the grid.
    expect(snapDuration(45, [60, 90, 120])).toBe(60);
    expect(snapDuration(100, [60, 90, 120])).toBe(90);
    expect(snapDuration(115, [60, 90, 120])).toBe(120);
    expect(snapDuration(9999, [60, 90, 120])).toBe(120);
  });
});

describe("closed runs", () => {
  it("collapses contiguous closed bands into one run", () => {
    expect(runsFromClosedMinutes([0, 30, 60], STEP)).toEqual([
      { fromMinute: 0, toMinute: 90 },
    ]);
  });

  it("keeps a gap between two separate closures", () => {
    // The morning is shut and there is a maintenance block at 12:00 — two
    // closures on one court, which the old per-court flag could not express.
    expect(runsFromClosedMinutes([0, 30, 360, 390], STEP)).toEqual([
      { fromMinute: 0, toMinute: 60 },
      { fromMinute: 360, toMinute: 420 },
    ]);
  });

  it("sorts before collapsing, so input order does not matter", () => {
    expect(runsFromClosedMinutes([60, 0, 30], STEP)).toEqual([
      { fromMinute: 0, toMinute: 90 },
    ]);
  });

  it("returns nothing for a court that is open all day", () => {
    expect(runsFromClosedMinutes([], STEP)).toEqual([]);
  });

  it("answers whether a given minute is inside a closure", () => {
    const runs = runsFromClosedMinutes([360, 390], STEP);
    expect(isClosedAt(runs, 360)).toBe(true);
    expect(isClosedAt(runs, 390)).toBe(true);
    expect(isClosedAt(runs, 420)).toBe(false);
    expect(isClosedAt(runs, 330)).toBe(false);
  });
});

describe("placing a booking", () => {
  const base = {
    courtId: "crt-1",
    step: STEP,
    lastMinute: 1200,
    closedByCourt: new Map(),
    occupied: new Set<string>(),
  };

  it("accepts an empty span", () => {
    expect(
      spanIsFree({ ...base, startMinute: 600, durationMinutes: 90 }),
    ).toBe(true);
  });

  it("refuses a span that runs past closing", () => {
    expect(
      spanIsFree({ ...base, startMinute: 1170, durationMinutes: 90 }),
    ).toBe(false);
  });

  it("refuses a span whose LATER bands are taken, not only its first", () => {
    // The regression this guards: checking only the start minute lets a
    // 120-minute booking be dropped in front of a booking 90 minutes later.
    const occupied = new Set(["crt-1:690"]);
    expect(
      spanIsFree({ ...base, occupied, startMinute: 600, durationMinutes: 120 }),
    ).toBe(false);
    expect(
      spanIsFree({ ...base, occupied, startMinute: 600, durationMinutes: 60 }),
    ).toBe(true);
  });

  it("refuses a span crossing a mid-day closure", () => {
    const closedByCourt = new Map([["crt-1", runsFromClosedMinutes([690], STEP)]]);
    expect(
      spanIsFree({ ...base, closedByCourt, startMinute: 600, durationMinutes: 120 }),
    ).toBe(false);
  });

  it("lets a booking overlap ITSELF, so a nudge onto its own bands succeeds", () => {
    const occupied = new Set(["crt-1:600", "crt-1:630", "crt-1:660"]);
    const occupantAt = () => "bkg-1";
    expect(
      spanIsFree({
        ...base,
        occupied,
        occupantAt,
        startMinute: 600,
        durationMinutes: 90,
        ignoreBookingId: "bkg-1",
      }),
    ).toBe(true);
  });

  it("still refuses when the bands belong to a DIFFERENT booking", () => {
    const occupied = new Set(["crt-1:600"]);
    const occupantAt = () => "bkg-2";
    expect(
      spanIsFree({
        ...base,
        occupied,
        occupantAt,
        startMinute: 600,
        durationMinutes: 60,
        ignoreBookingId: "bkg-1",
      }),
    ).toBe(false);
  });
});

describe("now, in the venue's own time", () => {
  it("places a mid-evening instant at the right minute", () => {
    // 2026-07-28T15:00:00Z is 19:00 in Dubai (UTC+4) = 13h after 06:00.
    const at = Date.parse("2026-07-28T15:00:00Z");
    expect(minuteOfDayInVenue(at, "Asia/Dubai")).toBe(13 * 60);
  });

  it("wraps past midnight rather than clamping to zero", () => {
    // 2026-07-28T21:00:00Z is 01:00 next day in Dubai — still the 28th's board.
    const at = Date.parse("2026-07-28T21:00:00Z");
    expect(minuteOfDayInVenue(at, "Asia/Dubai")).toBe(19 * 60);
  });
});
