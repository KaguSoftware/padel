import { beforeEach, describe, expect, it } from "vitest";
import { isSlotTaken, RuleViolation, SlotTakenError } from "@/domain/errors";
import { dirhams, fils, ZERO } from "@/lib/money";
import { instantAt, localDate, todayInDubai } from "@/lib/time";
import type { Db } from "../ports";
import { createMemoryDb } from "./driver";
import { resetStore } from "./store";

/**
 * The driver's contract is not "stores rows" — it is "fails exactly the way
 * Postgres will fail". These tests pin the failure modes, because those are
 * what every screen is written against.
 */

const DAY = todayInDubai();

function db(): Db {
  resetStore();
  return createMemoryDb();
}

function slot(startMinute: number, duration = 90) {
  return {
    start: instantAt(DAY, startMinute),
    end: instantAt(DAY, startMinute + duration),
  };
}

const LINES = [
  { code: "court", label: "Test", labelAr: "", amount: dirhams(200) },
];

function input(courtId: string, startMinute: number, over: Record<string, unknown> = {}) {
  const { start, end } = slot(startMinute);
  return {
    courtId,
    start,
    end,
    status: "confirmed" as const,
    source: "staff" as const,
    customerId: null,
    partySize: 4,
    priceLines: LINES,
    createdBy: "usr-desk-1",
    ...over,
  };
}

/**
 * Find a start minute with `runMinutes` of clear court in the seeded day.
 *
 * The seed is deliberately uneven, so tests must locate their own space rather
 * than assume a fixed hour is free — otherwise they fail on whichever day the
 * generator happens to fill.
 */
async function freeSpot(d: Db, courtId = "crt-1", runMinutes = 90) {
  const existing = await d.bookings.listForDay(DAY);
  for (let m = 0; m + runMinutes <= 1020; m += 30) {
    const start = instantAt(DAY, m);
    const end = instantAt(DAY, m + runMinutes);
    const clash = existing.some(
      (b) =>
        b.courtId === courtId &&
        b.status !== "cancelled" &&
        b.status !== "expired" &&
        b.start < end &&
        start < b.end,
    );
    if (!clash) return m;
  }
  throw new Error(`no ${runMinutes}-minute run free on ${courtId}`);
}

describe("the exclusion constraint, in JS", () => {
  let d: Db;
  beforeEach(() => {
    d = db();
  });

  it("THE RACE: N simultaneous attempts on one slot, exactly one wins", async () => {
    const m = await freeSpot(d);

    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => d.bookings.create(input("crt-1", m))),
    );

    const won = results.filter((r) => r.status === "fulfilled");
    const lost = results.filter((r) => r.status === "rejected");

    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(7);
    for (const l of lost) {
      expect(isSlotTaken((l as PromiseRejectedResult).reason)).toBe(true);
    }
  });

  it("rejects a booking that merely overlaps, not only an exact match", async () => {
    const m = await freeSpot(d);
    await d.bookings.create(input("crt-1", m)); // m .. m+90

    // Starts inside it.
    await expect(d.bookings.create(input("crt-1", m + 30))).rejects.toBeInstanceOf(
      SlotTakenError,
    );
    // Ends inside it.
    await expect(d.bookings.create(input("crt-1", m - 30))).rejects.toBeInstanceOf(
      SlotTakenError,
    );
    // Contains it.
    await expect(
      d.bookings.create(input("crt-1", m - 30, { ...slot(m - 30, 150) })),
    ).rejects.toBeInstanceOf(SlotTakenError);
  });

  it("is half-open: a booking may start exactly when another ends", async () => {
    // Needs 180 clear minutes, since it books two back-to-back slots.
    const m = await freeSpot(d, "crt-1", 180);
    await d.bookings.create(input("crt-1", m));
    const next = await d.bookings.create(input("crt-1", m + 90));
    expect(next.id).toBeTruthy();
  });

  it("scopes the conflict to one court", async () => {
    const m = await freeSpot(d);
    await d.bookings.create(input("crt-1", m));
    // Court 2 at the same time is fine — unless the seed already took it.
    const m2 = await freeSpot(d, "crt-2");
    const other = await d.bookings.create(input("crt-2", m2));
    expect(other.courtId).toBe("crt-2");
  });

  it("a held booking blocks the slot; a cancelled one releases it", async () => {
    const m = await freeSpot(d);
    const held = await d.bookings.create(
      input("crt-1", m, { status: "held", holdTtlMinutes: 8 }),
    );
    await expect(d.bookings.create(input("crt-1", m))).rejects.toBeInstanceOf(
      SlotTakenError,
    );

    await d.bookings.cancel(held.id, "usr-desk-1", "changed mind", {
      amount: ZERO,
      kind: "none",
    });
    const after = await d.bookings.create(input("crt-1", m));
    expect(after.id).toBeTruthy();
  });

  it("refuses a zero-length or reversed period", async () => {
    const { start } = slot(300);
    await expect(
      d.bookings.create(input("crt-1", 300, { start, end: start })),
    ).rejects.toBeInstanceOf(RuleViolation);
  });
});

describe("moving a booking", () => {
  let d: Db;
  beforeEach(() => {
    d = db();
  });

  it("moves onto a free slot and frees the origin atomically", async () => {
    const from = await freeSpot(d);
    const b = await d.bookings.create(input("crt-1", from));

    const to = await freeSpot(d, "crt-2");
    const moved = await d.bookings.move(
      b.id,
      "crt-2",
      instantAt(DAY, to),
      "usr-desk-1",
    );

    expect(moved.courtId).toBe("crt-2");
    // The origin is now bookable.
    const backfill = await d.bookings.create(input("crt-1", from));
    expect(backfill.id).toBeTruthy();
  });

  it("refuses a move onto an occupied slot and leaves the booking where it was", async () => {
    const a = await freeSpot(d);
    const first = await d.bookings.create(input("crt-1", a));
    const b = await freeSpot(d, "crt-2");
    const second = await d.bookings.create(input("crt-2", b));

    await expect(
      d.bookings.move(second.id, "crt-1", instantAt(DAY, a), "usr-desk-1"),
    ).rejects.toBeInstanceOf(SlotTakenError);

    const unchanged = await d.bookings.get(second.id);
    expect(unchanged?.courtId).toBe("crt-2");
    expect(unchanged?.start.getTime()).toBe(instantAt(DAY, b).getTime());
    expect(first.courtId).toBe("crt-1");
  });

  it("a no-op move onto itself succeeds — it must not conflict with itself", async () => {
    const m = await freeSpot(d);
    const b = await d.bookings.create(input("crt-1", m));
    const moved = await d.bookings.move(
      b.id,
      "crt-1",
      instantAt(DAY, m),
      "usr-desk-1",
    );
    expect(moved.id).toBe(b.id);
  });
});

describe("holds", () => {
  let d: Db;
  beforeEach(() => {
    d = db();
  });

  it("carries a TTL and is swept once it lapses", async () => {
    const m = await freeSpot(d);
    const held = await d.bookings.create(
      input("crt-1", m, { status: "held", holdTtlMinutes: 8 }),
    );
    expect(held.holdExpiresAt).not.toBeNull();

    // Nothing expires before its time.
    expect(await d.bookings.expireHolds(new Date())).toBe(0);

    const later = new Date(Date.now() + 9 * 60_000);
    expect(await d.bookings.expireHolds(later)).toBeGreaterThanOrEqual(1);
    expect((await d.bookings.get(held.id))?.status).toBe("expired");

    // And the slot is free again.
    const retaken = await d.bookings.create(input("crt-1", m));
    expect(retaken.id).toBeTruthy();
  });

  it("the sweep is idempotent", async () => {
    const m = await freeSpot(d);
    await d.bookings.create(input("crt-1", m, { status: "held", holdTtlMinutes: 1 }));
    const later = new Date(Date.now() + 5 * 60_000);
    const first = await d.bookings.expireHolds(later);
    const second = await d.bookings.expireHolds(later);
    expect(first).toBeGreaterThan(0);
    expect(second).toBe(0);
  });

  it("confirming a lapsed hold is refused, not silently accepted", async () => {
    const m = await freeSpot(d);
    const held = await d.bookings.create(
      input("crt-1", m, { status: "held", holdTtlMinutes: 8 }),
    );
    await d.bookings.expireHolds(new Date(Date.now() + 9 * 60_000));

    await expect(d.bookings.confirmHold(held.id, "usr-desk-1")).rejects.toThrow(
      /expired/i,
    );
  });

  it("confirming a live hold clears its expiry", async () => {
    const m = await freeSpot(d);
    const held = await d.bookings.create(
      input("crt-1", m, { status: "held", holdTtlMinutes: 8 }),
    );
    const confirmed = await d.bookings.confirmHold(held.id, "usr-desk-1");
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.holdExpiresAt).toBeNull();
  });
});

describe("bulk operations are one call, not one per row", () => {
  let d: Db;
  beforeEach(() => {
    d = db();
  });

  it("cancels many and reports what it could not do", async () => {
    const ids: string[] = [];
    for (const m of [60, 150, 240]) {
      const b = await d.bookings.create(input("crt-3", m)).catch(() => null);
      if (b) ids.push(b.id);
    }
    const res = await d.bookings.cancelMany(
      [...ids, "does-not-exist"],
      "usr-manager",
      "Tournament block",
    );
    expect(res.cancelled).toHaveLength(ids.length);
    expect(res.conflicted).toContain("does-not-exist");
  });

  it("blocks a range, counting the slots it could not take", async () => {
    const m = await freeSpot(d, "crt-4");
    await d.bookings.create(input("crt-4", m));

    const res = await d.bookings.blockMany([
      input("crt-4", m, { status: "blocked", blockReason: "Maintenance" }),
      input("crt-4", m + 90, { status: "blocked", blockReason: "Maintenance" }),
    ]);
    expect(res.conflicted).toBe(1);
    expect(res.created).toHaveLength(1);
  });
});

describe("participants and money", () => {
  let d: Db;
  beforeEach(() => {
    d = db();
  });

  it("refuses to overfill a match", async () => {
    const m = await freeSpot(d);
    const b = await d.bookings.create(input("crt-1", m, { partySize: 2 }));

    await d.participants.add({
      bookingId: b.id,
      customerId: "cus-1",
      guestName: null,
      share: dirhams(100),
      paid: ZERO,
      paidAt: null,
      isBooker: true,
    });
    await d.participants.add({
      bookingId: b.id,
      customerId: "cus-2",
      guestName: null,
      share: dirhams(100),
      paid: ZERO,
      paidAt: null,
      isBooker: false,
    });

    await expect(
      d.participants.add({
        bookingId: b.id,
        customerId: "cus-3",
        guestName: null,
        share: ZERO,
        paid: ZERO,
        paidAt: null,
        isBooker: false,
      }),
    ).rejects.toBeInstanceOf(RuleViolation);
  });

  it("refuses the same customer twice on one match", async () => {
    const m = await freeSpot(d);
    const b = await d.bookings.create(input("crt-1", m));
    const p = {
      bookingId: b.id,
      customerId: "cus-1",
      guestName: null,
      share: dirhams(50),
      paid: ZERO,
      paidAt: null,
      isBooker: true,
    };
    await d.participants.add(p);
    await expect(d.participants.add({ ...p, isBooker: false })).rejects.toBeInstanceOf(
      RuleViolation,
    );
  });

  it("advances payment status as money comes in", async () => {
    const m = await freeSpot(d);
    const b = await d.bookings.create(input("crt-1", m)); // 200

    await d.payments.take({
      bookingId: b.id,
      saleId: null,
      participantId: null,
      amount: dirhams(50),
      method: "cash",
      takenBy: "usr-desk-1",
      takenAt: new Date(),
      tillSessionId: null,
      refundOf: null,
      note: "",
    });
    expect((await d.bookings.get(b.id))?.paymentStatus).toBe("part_paid");

    await d.payments.take({
      bookingId: b.id,
      saleId: null,
      participantId: null,
      amount: dirhams(150),
      method: "card",
      takenBy: "usr-desk-1",
      takenAt: new Date(),
      tillSessionId: null,
      refundOf: null,
      note: "",
    });
    expect((await d.bookings.get(b.id))?.paymentStatus).toBe("paid");
  });

  it("credits a customer's balance when a cancellation returns credit", async () => {
    const before = (await d.customers.get("cus-1"))!.creditBalance;
    const m = await freeSpot(d);
    const b = await d.bookings.create(input("crt-1", m, { customerId: "cus-1" }));

    await d.bookings.cancel(b.id, "usr-manager", "Rain", {
      amount: dirhams(100),
      kind: "credit",
    });

    const after = (await d.customers.get("cus-1"))!.creditBalance;
    expect(after - before).toBe(dirhams(100));
  });
});

describe("the till", () => {
  let d: Db;
  beforeEach(() => {
    d = db();
  });

  it("balances when the drawer matches float plus cash taken", async () => {
    // Start from a clean shift so the assertion does not depend on whatever
    // the seed generator happened to take earlier in the day.
    const seeded = await d.till.currentSession();
    await d.till.close(seeded!.id, ZERO, "reset for test", "usr-manager");

    const float = dirhams(500);
    const session = await d.till.open(localDate(DAY), float, "usr-desk-1");

    await d.payments.take({
      bookingId: null,
      saleId: null,
      participantId: null,
      amount: dirhams(200),
      method: "cash",
      takenBy: "usr-desk-1",
      takenAt: new Date(),
      tillSessionId: session.id,
      refundOf: null,
      note: "",
    });
    // A card payment must NOT affect the cash drawer.
    await d.payments.take({
      bookingId: null,
      saleId: null,
      participantId: null,
      amount: dirhams(999),
      method: "card",
      takenBy: "usr-desk-1",
      takenAt: new Date(),
      tillSessionId: session.id,
      refundOf: null,
      note: "",
    });

    const closed = await d.till.close(
      session.id,
      dirhams(700),
      "counted twice",
      "usr-desk-1",
    );
    expect(closed.variance).toBe(ZERO);
    expect(closed.closedBy).toBe("usr-desk-1");
  });

  it("reports a shortfall as a negative variance", async () => {
    const seeded = await d.till.currentSession();
    await d.till.close(seeded!.id, ZERO, "reset for test", "usr-manager");

    const session = await d.till.open(localDate(DAY), dirhams(500), "usr-desk-1");
    await d.payments.take({
      bookingId: null,
      saleId: null,
      participantId: null,
      amount: dirhams(200),
      method: "cash",
      takenBy: "usr-desk-1",
      takenAt: new Date(),
      tillSessionId: session.id,
      refundOf: null,
      note: "",
    });

    // AED 35 light — the number this whole module exists to surface.
    const closed = await d.till.close(
      session.id,
      dirhams(665),
      "unexplained",
      "usr-desk-1",
    );
    expect(closed.variance).toBe(dirhams(-35));
  });

  it("refuses to open a second shift while one is open", async () => {
    await expect(
      d.till.open(localDate(DAY), dirhams(500), "usr-desk-1"),
    ).rejects.toBeInstanceOf(RuleViolation);
  });
});

describe("the audit log", () => {
  let d: Db;
  beforeEach(() => {
    d = db();
  });

  it("records every money-touching mutation with its actor", async () => {
    const m = await freeSpot(d);
    const b = await d.bookings.create(input("crt-1", m));
    await d.bookings.setPriceLines(
      b.id,
      [
        ...LINES,
        {
          code: "discount",
          label: "Discount",
          labelAr: "",
          amount: fils(-5000),
          reason: "Regular",
          appliedBy: "usr-manager",
        },
      ],
      "usr-manager",
    );

    const recent = await d.audit.recent(20);
    const discount = recent.find((e) => e.action === "booking.discount");
    expect(discount).toBeTruthy();
    expect(discount?.actorId).toBe("usr-manager");
    expect(discount?.reason).toBe("Regular");
  });

  it("is append-only — the port exposes no update or delete", () => {
    const port = d.audit as unknown as Record<string, unknown>;
    expect(port.update).toBeUndefined();
    expect(port.delete).toBeUndefined();
    expect(port.remove).toBeUndefined();
  });
});

describe("customer dedupe", () => {
  let d: Db;
  beforeEach(() => {
    d = db();
  });

  it("finds a customer by any written form of their number", async () => {
    for (const form of ["0501234567", "+971 50 123 4567", "٠٥٠١٢٣٤٥٦٧"]) {
      const found = await d.customers.findByPhone(form);
      expect(found?.id).toBe("cus-1");
    }
  });

  it("returns null rather than a bogus match for junk", async () => {
    expect(await d.customers.findByPhone("")).toBeNull();
    expect(await d.customers.findByPhone("n/a")).toBeNull();
  });
});
