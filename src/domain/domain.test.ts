import { beforeEach, describe, expect, it } from "vitest";
import type {
  AvailabilityException,
  AvailabilityTemplate,
  Booking,
  BookingParticipant,
  BookingSeries,
  CancellationPolicy,
  Court,
  PricingRule,
} from "@/data/types";
import { addFils, dirhams, fils, ZERO } from "@/lib/money";
import {
  addDaysToLocalDate,
  instantAt,
  localDate,
  operatingDayOf,
} from "@/lib/time";
import { isOpenFor, resolveAvailability } from "./availability";
import { resolveCancellation } from "./cancellation";
import { isUnpriced, quote, totalOf } from "./pricing";
import {
  expandSeries,
  instancesToMaterialise,
  materialisationWindow,
} from "./recurrence";
import {
  bookableStarts,
  cellKey,
  computeDayGrid,
  utilisation,
} from "./slots";
import { canJoin, joinerQuote, openSeats, splitBooking } from "./split";

const TUE = localDate("2026-07-28"); // a Tuesday

const COURTS: Court[] = [
  {
    id: "c1",
    name: "Court 1",
    nameAr: "١",
    ordinal: 1,
    surface: "panoramic",
    enclosure: "indoor",
    tags: ["indoor", "premium"],
    active: true,
  },
  {
    id: "c2",
    name: "Court 2",
    nameAr: "٢",
    ordinal: 2,
    surface: "wall",
    enclosure: "outdoor",
    tags: ["outdoor"],
    active: true,
  },
];

/** Sun–Sat 06:00 → 00:00 for every court. */
const TEMPLATES: AvailabilityTemplate[] = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  id: `t${weekday}`,
  courtId: null,
  weekday,
  openMinute: 0,
  closeMinute: 1080,
}));

function booking(over: Partial<Booking>): Booking {
  return {
    id: "b",
    serial: 1,
    courtId: "c1",
    start: instantAt(TUE, 900),
    end: instantAt(TUE, 990),
    status: "confirmed",
    source: "web",
    operatingDay: TUE,
    customerId: "cus",
    partySize: 4,
    seriesId: null,
    seriesException: null,
    openMatch: false,
    levelMin: null,
    levelMax: null,
    priceLines: [],
    total: dirhams(200),
    paymentStatus: "paid",
    holdExpiresAt: null,
    notes: "",
    createdBy: "u",
    createdAt: new Date(),
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    refundAmount: null,
    refundKind: null,
    blockReason: null,
    ...over,
  };
}

// ---------------------------------------------------------------------------

describe("availability — computed, never stored", () => {
  it("opens every court on its template", () => {
    const a = resolveAvailability(TUE, COURTS, TEMPLATES, []);
    expect(a.windows).toHaveLength(2);
    expect(isOpenFor(a, "c1", 0, 1080)).toBe(true);
    expect(isOpenFor(a, "c1", 0, 1200)).toBe(false);
  });

  it("lets a court-specific template beat the venue-wide one", () => {
    const templates = [
      ...TEMPLATES,
      { id: "c2-tue", courtId: "c2", weekday: 2, openMinute: 0, closeMinute: 960 },
    ];
    const a = resolveAvailability(TUE, COURTS, templates, []);
    expect(isOpenFor(a, "c2", 0, 1080)).toBe(false);
    expect(isOpenFor(a, "c2", 0, 960)).toBe(true);
    // c1 is untouched.
    expect(isOpenFor(a, "c1", 0, 1080)).toBe(true);
  });

  it("applies Ramadan hours as a row, not a code branch", () => {
    const ramadan: AvailabilityException = {
      id: "r",
      courtId: null,
      from: addDaysToLocalDate(TUE, -1),
      to: addDaysToLocalDate(TUE, 20),
      kind: "ramadan",
      openMinute: 480, // 14:00
      closeMinute: 1200, // 02:00
      note: "Ramadan hours",
      noteAr: "توقيت رمضان",
    };
    const a = resolveAvailability(TUE, COURTS, TEMPLATES, [ramadan]);
    expect(isOpenFor(a, "c1", 0, 60)).toBe(false); // 06:00 is now closed
    expect(isOpenFor(a, "c1", 480, 1200)).toBe(true);
    // The note still surfaces so staff know why the day starts late.
    expect(a.closures.some((c) => c.kind === "ramadan")).toBe(true);
  });

  it("closes a court entirely when the exception has no hours", () => {
    const maintenance: AvailabilityException = {
      id: "m",
      courtId: "c2",
      from: TUE,
      to: TUE,
      kind: "maintenance",
      openMinute: null,
      closeMinute: null,
      note: "Resurfacing",
      noteAr: "إعادة تسطيح",
    };
    const a = resolveAvailability(TUE, COURTS, TEMPLATES, [maintenance]);
    expect(a.windows.map((w) => w.courtId)).toEqual(["c1"]);
    expect(isOpenFor(a, "c2", 0, 60)).toBe(false);
  });

  it("narrowest wins: a court exception beats a venue-wide one", () => {
    const venueWide: AvailabilityException = {
      id: "v",
      courtId: null,
      from: TUE,
      to: TUE,
      kind: "holiday",
      openMinute: null,
      closeMinute: null,
      note: "Closed",
      noteAr: "مغلق",
    };
    const courtOpen: AvailabilityException = {
      id: "co",
      courtId: "c1",
      from: TUE,
      to: TUE,
      kind: "private",
      openMinute: 600,
      closeMinute: 900,
      note: "Private hire",
      noteAr: "حجز خاص",
    };
    const a = resolveAvailability(TUE, COURTS, TEMPLATES, [venueWide, courtOpen]);
    expect(isOpenFor(a, "c1", 600, 900)).toBe(true);
    expect(isOpenFor(a, "c2", 600, 900)).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe("slots", () => {
  const availability = () => resolveAvailability(TUE, COURTS, TEMPLATES, []);

  it("marks a booked cell occupied and leaves its neighbours open", () => {
    const grid = computeDayGrid({
      day: TUE,
      courts: COURTS,
      availability: availability(),
      bookings: [booking({ id: "b1" })], // 900–990
      now: instantAt(TUE, 0),
    });

    expect(grid.cells.get(cellKey("c1", 900))?.state).toBe("occupied");
    expect(grid.cells.get(cellKey("c1", 930))?.state).toBe("occupied");
    expect(grid.cells.get(cellKey("c1", 960))?.state).toBe("occupied");
    expect(grid.cells.get(cellKey("c1", 990))?.state).toBe("open");
    expect(grid.cells.get(cellKey("c1", 870))?.state).toBe("open");
    // A different court is unaffected.
    expect(grid.cells.get(cellKey("c2", 900))?.state).toBe("open");
  });

  it("ignores cancelled and expired bookings when deciding occupancy", () => {
    const grid = computeDayGrid({
      day: TUE,
      courts: COURTS,
      availability: availability(),
      bookings: [
        booking({ id: "x", status: "cancelled" }),
        booking({ id: "y", status: "expired" }),
      ],
      now: instantAt(TUE, 0),
    });
    expect(grid.cells.get(cellKey("c1", 900))?.state).toBe("open");
  });

  it("treats a held booking as occupying — that is the point of the hold", () => {
    const grid = computeDayGrid({
      day: TUE,
      courts: COURTS,
      availability: availability(),
      bookings: [booking({ id: "h", status: "held" })],
      now: instantAt(TUE, 0),
    });
    expect(grid.cells.get(cellKey("c1", 900))?.state).toBe("occupied");
  });

  it("offers only starts where every spanned cell is free", () => {
    const grid = computeDayGrid({
      day: TUE,
      courts: COURTS,
      availability: availability(),
      bookings: [booking({ id: "b1" })], // 900–990
      now: instantAt(TUE, 0),
    });

    const starts90 = bookableStarts(grid, "c1", 90);
    // 870 would run 870–960 and collide.
    expect(starts90).not.toContain(870);
    expect(starts90).not.toContain(900);
    expect(starts90).toContain(990);
    expect(starts90).toContain(600);
  });

  it("never offers a start that runs past closing", () => {
    const grid = computeDayGrid({
      day: TUE,
      courts: COURTS,
      availability: availability(),
      bookings: [],
      now: instantAt(TUE, 0),
    });
    const starts = bookableStarts(grid, "c1", 120);
    expect(Math.max(...starts)).toBe(1080 - 120);
  });

  it("distinguishes past from open, so this morning is still editable", () => {
    const grid = computeDayGrid({
      day: TUE,
      courts: COURTS,
      availability: availability(),
      bookings: [],
      now: instantAt(TUE, 600),
    });
    expect(grid.cells.get(cellKey("c1", 0))?.state).toBe("past");
    expect(grid.cells.get(cellKey("c1", 900))?.state).toBe("open");
    // A past cell is not bookable.
    expect(bookableStarts(grid, "c1", 60)).not.toContain(0);
  });

  it("computes utilisation over open cells only", () => {
    const empty = computeDayGrid({
      day: TUE,
      courts: COURTS,
      availability: availability(),
      bookings: [],
      now: instantAt(TUE, 0),
    });
    expect(utilisation(empty)).toBe(0);

    const one = computeDayGrid({
      day: TUE,
      courts: COURTS,
      availability: availability(),
      bookings: [booking({ id: "b1" })],
      now: instantAt(TUE, 0),
    });
    // 90 minutes booked out of 2 courts x 1080 minutes open.
    expect(utilisation(one)).toBeCloseTo(90 / 2160, 6);
  });
});

// ---------------------------------------------------------------------------

describe("pricing — table-driven", () => {
  const rules: PricingRule[] = [
    {
      id: "base90",
      label: "Off-peak 90",
      labelAr: "",
      priority: 10,
      weekdays: [],
      fromMinute: null,
      toMinute: null,
      courtIds: [],
      courtTags: [],
      tiers: [],
      durations: [90],
      amount: dirhams(130),
      active: true,
    },
    {
      id: "peak90",
      label: "Peak 90",
      labelAr: "",
      priority: 40,
      weekdays: [],
      fromMinute: 720,
      toMinute: 1020,
      courtIds: [],
      courtTags: [],
      tiers: [],
      durations: [90],
      amount: dirhams(200),
      active: true,
    },
    {
      id: "member90",
      label: "Member peak 90",
      labelAr: "",
      priority: 90,
      weekdays: [],
      fromMinute: 720,
      toMinute: 1020,
      courtIds: [],
      courtTags: [],
      tiers: ["member", "premium"],
      durations: [90],
      amount: dirhams(170),
      active: true,
    },
    {
      id: "outdoor90",
      label: "Outdoor 90",
      labelAr: "",
      priority: 70,
      weekdays: [],
      fromMinute: null,
      toMinute: null,
      courtIds: [],
      courtTags: ["outdoor"],
      tiers: [],
      durations: [90],
      amount: dirhams(110),
      active: true,
    },
  ];

  const at = (startMinute: number, court = COURTS[0], tier: "guest" | "member" = "guest") =>
    quote({ day: TUE, startMinute, durationMinutes: 90, court, tier, rules });

  it("prices off-peak from the base rule", () => {
    expect(at(300).total).toBe(dirhams(130));
  });

  it("prices the evening from the peak rule", () => {
    expect(at(900).total).toBe(dirhams(200));
  });

  it("lets tier beat hour: a member pays less at peak", () => {
    expect(at(900, COURTS[0], "member").total).toBe(dirhams(170));
  });

  it("matches a court by tag", () => {
    expect(at(300, COURTS[1]).total).toBe(dirhams(110));
  });

  it("matches the rule on the slot's START, so duration never splits a band", () => {
    // 17:30 start (minute 690) is off-peak even though it runs into peak.
    expect(at(690).total).toBe(dirhams(130));
    // 18:00 start is peak.
    expect(at(720).total).toBe(dirhams(200));
  });

  it("flags a configuration gap instead of quoting zero as a real price", () => {
    const q = quote({
      day: TUE,
      startMinute: 900,
      durationMinutes: 45, // no rule covers 45 minutes
      court: COURTS[0],
      tier: "guest",
      rules,
    });
    expect(isUnpriced(q)).toBe(true);
    expect(q.total).toBe(ZERO);
  });

  it("applies a promo then a discount, in that order, and itemises both", () => {
    const q = quote({
      day: TUE,
      startMinute: 900,
      durationMinutes: 90,
      court: COURTS[0],
      tier: "guest",
      rules,
      promo: {
        id: "p",
        code: "TEN",
        label: "10 off",
        labelAr: "",
        kind: "percent",
        value: 10,
        from: null,
        to: null,
        maxUses: null,
        uses: 0,
        active: true,
      },
      discount: { percent: 50, reason: "Manager comp", appliedBy: "u1" },
    });

    // 200 -> 180 -> 90
    expect(q.total).toBe(dirhams(90));
    expect(totalOf(q.lines)).toBe(q.total);

    const discount = q.lines.find((l) => l.code === "discount");
    expect(discount?.reason).toBe("Manager comp");
    expect(discount?.appliedBy).toBe("u1");
  });

  it("never lets a promo take the total below zero", () => {
    const q = quote({
      day: TUE,
      startMinute: 900,
      durationMinutes: 90,
      court: COURTS[0],
      tier: "guest",
      rules,
      promo: {
        id: "p",
        code: "BIG",
        label: "huge",
        labelAr: "",
        kind: "amount",
        value: dirhams(9999),
        from: null,
        to: null,
        maxUses: null,
        uses: 0,
        active: true,
      },
    });
    expect(q.total).toBe(ZERO);
  });

  it("ignores an expired promo", () => {
    const q = quote({
      day: TUE,
      startMinute: 900,
      durationMinutes: 90,
      court: COURTS[0],
      tier: "guest",
      rules,
      promo: {
        id: "p",
        code: "OLD",
        label: "old",
        labelAr: "",
        kind: "percent",
        value: 50,
        from: localDate("2020-01-01"),
        to: localDate("2020-12-31"),
        maxUses: null,
        uses: 0,
        active: true,
      },
    });
    expect(q.total).toBe(dirhams(200));
  });

  it("the stored total always equals the sum of the stored lines", () => {
    for (const m of [0, 300, 690, 720, 900, 1010]) {
      const q = at(m);
      expect(totalOf(q.lines)).toBe(q.total);
    }
  });
});

// ---------------------------------------------------------------------------

describe("recurrence — the club's actual business model", () => {
  const series: BookingSeries = {
    id: "s1",
    courtId: "c1",
    customerId: "cus1",
    weekday: 2, // Tuesday
    startMinute: 900, // 21:00
    durationMinutes: 90,
    from: localDate("2026-07-01"),
    until: null,
    partySize: 4,
    active: true,
    createdBy: "u",
    createdAt: new Date(),
  };

  it("expands to one instance per week, on the right weekday", () => {
    const out = expandSeries(series, TUE, addDaysToLocalDate(TUE, 27), []);
    expect(out).toHaveLength(4);
    expect(out.map((i) => i.day)).toEqual([
      "2026-07-28",
      "2026-08-04",
      "2026-08-11",
      "2026-08-18",
    ]);
    for (const i of out) {
      expect(operatingDayOf(i.start)).toBe(i.day);
    }
  });

  it("honours a skip without breaking the rest of the series", () => {
    const out = expandSeries(series, TUE, addDaysToLocalDate(TUE, 27), [
      {
        id: "x",
        seriesId: "s1",
        day: localDate("2026-08-04"),
        kind: "skip",
        movedToStart: null,
        movedToCourtId: null,
        overrideTotal: null,
        reason: "Travelling",
      },
    ]);
    expect(out.map((i) => i.day)).toEqual([
      "2026-07-28",
      "2026-08-11",
      "2026-08-18",
    ]);
  });

  it("moves a single instance while keeping it attributed to the series", () => {
    const movedTo = instantAt(localDate("2026-08-04"), 780);
    const out = expandSeries(series, TUE, addDaysToLocalDate(TUE, 13), [
      {
        id: "x",
        seriesId: "s1",
        day: localDate("2026-08-04"),
        kind: "move",
        movedToStart: movedTo,
        movedToCourtId: "c2",
        overrideTotal: null,
        reason: "Court booked for a tournament",
      },
    ]);
    const moved = out.find((i) => i.day === "2026-08-04")!;
    expect(moved.courtId).toBe("c2");
    expect(moved.start.getTime()).toBe(movedTo.getTime());
    expect(moved.seriesId).toBe("s1");
    expect(moved.movedFrom?.courtId).toBe("c1");
  });

  it("stops at `until`", () => {
    const bounded = { ...series, until: localDate("2026-08-05") };
    const out = expandSeries(bounded, TUE, addDaysToLocalDate(TUE, 27), []);
    expect(out.map((i) => i.day)).toEqual(["2026-07-28", "2026-08-04"]);
  });

  it("produces nothing for an inactive series", () => {
    expect(
      expandSeries({ ...series, active: false }, TUE, addDaysToLocalDate(TUE, 27), []),
    ).toEqual([]);
  });

  it("THE SWEEP IS IDEMPOTENT — running it twice creates nothing the second time", () => {
    const planned = expandSeries(series, TUE, addDaysToLocalDate(TUE, 27), []);

    // First run: nothing exists yet, everything is due.
    const first = instancesToMaterialise(planned, []);
    expect(first).toHaveLength(4);

    // Second run: those four now exist.
    const existing = first.map((i) => ({ seriesId: i.seriesId, operatingDay: i.day }));
    const second = instancesToMaterialise(planned, existing);
    expect(second).toHaveLength(0);
  });

  it("does not treat an unrelated booking on the same day as its instance", () => {
    const planned = expandSeries(series, TUE, addDaysToLocalDate(TUE, 6), []);
    const walkIn = [{ seriesId: null, operatingDay: TUE }];
    expect(instancesToMaterialise(planned, walkIn)).toHaveLength(1);
  });

  it("rolls a 56-day window forward from today", () => {
    const w = materialisationWindow(TUE);
    expect(w.from).toBe(TUE);
    expect(w.to).toBe("2026-09-22");
  });
});

// ---------------------------------------------------------------------------

describe("cancellation — policy as data", () => {
  const policies: CancellationPolicy[] = [
    { id: "48", label: "48h+", labelAr: "", hoursBefore: 48, refundPercent: 100, outcome: "refund", priority: 30, active: true },
    { id: "12", label: "12–48h", labelAr: "", hoursBefore: 12, refundPercent: 100, outcome: "credit", priority: 20, active: true },
    { id: "4", label: "4–12h", labelAr: "", hoursBefore: 4, refundPercent: 50, outcome: "credit", priority: 10, active: true },
  ];

  const start = instantAt(TUE, 900);
  const hoursBefore = (h: number) => new Date(start.getTime() - h * 3_600_000);

  it("picks the most generous tier the customer still satisfies", () => {
    const paid = booking({ start, paymentStatus: "paid", total: dirhams(200) });
    expect(resolveCancellation(paid, policies, hoursBefore(50)).policy?.id).toBe("48");
    expect(resolveCancellation(paid, policies, hoursBefore(24)).policy?.id).toBe("12");
    expect(resolveCancellation(paid, policies, hoursBefore(6)).policy?.id).toBe("4");
  });

  it("returns nothing inside the no-refund window, by absence not a 0% row", () => {
    const paid = booking({ start, paymentStatus: "paid", total: dirhams(200) });
    const out = resolveCancellation(paid, policies, hoursBefore(1));
    expect(out.policy).toBeNull();
    expect(out.refundAmount).toBe(ZERO);
    expect(out.refundKind).toBe("none");
  });

  it("computes the refund from what was paid, not the headline price", () => {
    const unpaid = booking({ start, paymentStatus: "unpaid", total: dirhams(200) });
    expect(resolveCancellation(unpaid, policies, hoursBefore(50)).refundAmount).toBe(ZERO);

    const paid = booking({ start, paymentStatus: "paid", total: dirhams(200) });
    expect(resolveCancellation(paid, policies, hoursBefore(6)).refundAmount).toBe(
      dirhams(100),
    );
  });

  it("ignores an inactive tier", () => {
    const paid = booking({ start, paymentStatus: "paid", total: dirhams(200) });
    const disabled = policies.map((p) =>
      p.id === "48" ? { ...p, active: false } : p,
    );
    expect(resolveCancellation(paid, disabled, hoursBefore(50)).policy?.id).toBe("12");
  });
});

// ---------------------------------------------------------------------------

describe("split — four players, four shares", () => {
  let joined = 0;
  function participant(over: Partial<BookingParticipant> = {}): BookingParticipant {
    joined += 1;
    return {
      id: `p${joined}`,
      bookingId: "b",
      customerId: `cus${joined}`,
      guestName: null,
      share: ZERO,
      paid: ZERO,
      paidAt: null,
      isBooker: false,
      joinedAt: new Date(2026, 0, 1, 0, joined),
      ...over,
    };
  }

  beforeEach(() => {
    joined = 0;
  });

  it("divides evenly and the shares sum to the total", () => {
    const ps = [participant({ isBooker: true }), participant(), participant(), participant()];
    const out = splitBooking(dirhams(200), ps);
    expect(out.shares.map((s) => s.share)).toEqual([5000, 5000, 5000, 5000]);
    expect(addFils(...out.shares.map((s) => s.share))).toBe(dirhams(200));
  });

  it("gives an awkward remainder to the booker, deterministically", () => {
    const ps = [participant(), participant({ isBooker: true }), participant()];
    const out = splitBooking(dirhams(100), ps);
    expect(out.shares[0].isBooker).toBe(true);
    expect(out.shares.map((s) => s.share)).toEqual([3334, 3333, 3333]);
    expect(addFils(...out.shares.map((s) => s.share))).toBe(dirhams(100));
  });

  it("reports part-paid when only some shares have settled", () => {
    const ps = [
      participant({ isBooker: true, paid: fils(5000) }),
      participant(),
      participant(),
      participant(),
    ];
    const out = splitBooking(dirhams(200), ps);
    expect(out.status).toBe("part_paid");
    expect(out.collected).toBe(dirhams(50));
    expect(out.outstanding).toBe(dirhams(150));
    expect(out.shares[0].settled).toBe(true);
    expect(out.shares[1].settled).toBe(false);
  });

  it("reports paid once every share is settled", () => {
    const ps = [1, 2, 3, 4].map(() => participant({ paid: fils(5000) }));
    const out = splitBooking(dirhams(200), ps);
    expect(out.status).toBe("paid");
    expect(out.outstanding).toBe(ZERO);
  });

  it("counts open seats", () => {
    expect(openSeats(4, 2)).toBe(2);
    expect(openSeats(4, 4)).toBe(0);
    expect(openSeats(4, 5)).toBe(0);
  });

  it("quotes a joiner the FILLED price, not the current per-head figure", () => {
    // Two players on a 200 court: their current share is 100 each, but a third
    // joining a four-person match will pay 50.
    expect(joinerQuote(dirhams(200), 4)).toBe(dirhams(50));
  });

  it("respects the level band, and always admits an unrated player", () => {
    expect(canJoin(3.5, 3, 4.5)).toBe(true);
    expect(canJoin(2.0, 3, 4.5)).toBe(false);
    expect(canJoin(5.0, 3, 4.5)).toBe(false);
    expect(canJoin(null, 3, 4.5)).toBe(true);
    expect(canJoin(2.0, null, null)).toBe(true);
  });
});
