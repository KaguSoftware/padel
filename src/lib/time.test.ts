import { describe, expect, it } from "vitest";
import {
  addDaysToLocalDate,
  clock,
  dayWindow,
  durationMinutes,
  instantAt,
  localDate,
  minutesIntoDay,
  operatingDayOf,
  overlaps,
  todayInDubai,
  venueWeekday,
} from "./time";

const DAY = localDate("2026-07-28"); // a Tuesday

describe("operatingDayOf — the day runs 06:00 to 02:00", () => {
  it("puts a 21:00 booking on its own day", () => {
    // 21:00 Dubai = 17:00 UTC
    expect(operatingDayOf(new Date("2026-07-28T17:00:00Z"))).toBe("2026-07-28");
  });

  it("puts a 01:00 booking on the PREVIOUS day's page and till", () => {
    // 01:00 Dubai on the 29th = 21:00 UTC on the 28th
    expect(operatingDayOf(new Date("2026-07-28T21:00:00Z"))).toBe("2026-07-28");
    // 01:30 Dubai on the 29th
    expect(operatingDayOf(new Date("2026-07-28T21:30:00Z"))).toBe("2026-07-28");
  });

  it("rolls over at 06:00, not midnight", () => {
    // 05:59 Dubai on the 29th = 01:59 UTC on the 29th -> still the 28th
    expect(operatingDayOf(new Date("2026-07-29T01:59:00Z"))).toBe("2026-07-28");
    // 06:00 Dubai on the 29th = 02:00 UTC -> the 29th
    expect(operatingDayOf(new Date("2026-07-29T02:00:00Z"))).toBe("2026-07-29");
  });

  it("does not repeat the UTC-slice bug", () => {
    // 02:00 Dubai on the 29th is 22:00 UTC on the 28th. A naive
    // toISOString().slice(0,10) answers "2026-07-28" here by luck, but at
    // 10:00 Dubai it answers the right calendar day and the WRONG operating
    // day is never produced. Check the genuinely dangerous window instead.
    const at0030Dubai = new Date("2026-07-28T20:30:00Z"); // 00:30 on the 29th
    expect(at0030Dubai.toISOString().slice(0, 10)).toBe("2026-07-28");
    expect(operatingDayOf(at0030Dubai)).toBe("2026-07-28");

    const at0300Dubai = new Date("2026-07-28T23:00:00Z"); // 03:00 on the 29th
    expect(at0300Dubai.toISOString().slice(0, 10)).toBe("2026-07-28");
    // 03:00 is after the day ends at 02:00 but before 06:00 — still the 28th's page.
    expect(operatingDayOf(at0300Dubai)).toBe("2026-07-28");
  });

  it("todayInDubai agrees with operatingDayOf", () => {
    const now = new Date("2026-07-28T17:00:00Z");
    expect(todayInDubai(now)).toBe(operatingDayOf(now));
  });
});

describe("instantAt / minutesIntoDay", () => {
  it("minute 0 is 06:00 local", () => {
    expect(clock(instantAt(DAY, 0))).toBe("06:00");
  });

  it("minute 900 is 21:00 local", () => {
    expect(clock(instantAt(DAY, 900))).toBe("21:00");
  });

  it("minute 1140 is 01:00 the next calendar day, still this page", () => {
    const i = instantAt(DAY, 1140);
    expect(clock(i)).toBe("01:00");
    expect(operatingDayOf(i)).toBe(DAY);
  });

  it("round-trips", () => {
    for (const m of [0, 30, 450, 900, 1140, 1200]) {
      expect(minutesIntoDay(instantAt(DAY, m), DAY)).toBe(m);
    }
  });
});

describe("dayWindow", () => {
  it("spans exactly 20 hours", () => {
    const { start, end } = dayWindow(DAY);
    expect(durationMinutes(start, end)).toBe(20 * 60);
    expect(clock(start)).toBe("06:00");
    expect(clock(end)).toBe("02:00");
  });
});

describe("venueWeekday", () => {
  it("reads the local weekday, not UTC's", () => {
    // 2026-07-28 is a Tuesday = 2
    expect(venueWeekday(instantAt(DAY, 900))).toBe(2);
    // 01:00 on Wednesday morning is calendar-Wednesday even though it is the
    // Tuesday page — pricing rules match the wall clock, so this must be 3.
    expect(venueWeekday(instantAt(DAY, 1140))).toBe(3);
  });
});

describe("overlaps — the JS mirror of tstzrange &&", () => {
  const t = (h: number) => new Date(`2026-07-28T${String(h).padStart(2, "0")}:00:00Z`);

  it("is half-open: touching intervals do not overlap", () => {
    expect(overlaps(t(10), t(11), t(11), t(12))).toBe(false);
    expect(overlaps(t(11), t(12), t(10), t(11))).toBe(false);
  });

  it("detects containment and partial overlap in both directions", () => {
    expect(overlaps(t(10), t(12), t(11), t(13))).toBe(true);
    expect(overlaps(t(11), t(13), t(10), t(12))).toBe(true);
    expect(overlaps(t(10), t(14), t(11), t(12))).toBe(true);
    expect(overlaps(t(11), t(12), t(10), t(14))).toBe(true);
  });
});

describe("addDaysToLocalDate", () => {
  it("crosses a month boundary", () => {
    expect(addDaysToLocalDate(localDate("2026-07-31"), 1)).toBe("2026-08-01");
    expect(addDaysToLocalDate(localDate("2026-03-01"), -1)).toBe("2026-02-28");
  });

  it("crosses a leap day", () => {
    expect(addDaysToLocalDate(localDate("2028-02-28"), 1)).toBe("2028-02-29");
  });
});

describe("localDate", () => {
  it("refuses anything that is not YYYY-MM-DD", () => {
    expect(() => localDate("28/07/2026")).toThrow();
    expect(() => localDate("2026-7-8")).toThrow();
  });
});
