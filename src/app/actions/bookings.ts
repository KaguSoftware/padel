"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { getDb } from "@/data";
import type { BookingSource } from "@/data/types";
import { resolveCancellation } from "@/domain/cancellation";
import { isSlotTaken, RuleViolation } from "@/domain/errors";
import { quote } from "@/domain/pricing";
import { can } from "@/auth/guard";
import { requireUser } from "@/auth/guard";
import { fils, type Fils } from "@/lib/money";
import { instantAt, localDate, operatingDayOf } from "@/lib/time";

/**
 * Server actions for the booking core.
 *
 * Two rules run through all of them:
 *
 *  1. NEVER check availability then write. Attempt the write and catch the
 *     conflict. `SlotTakenError` is what both drivers throw, so the "just
 *     taken" path is identical against memory and against Postgres 23P01.
 *  2. Side effects go in `after()` — notifications, receipts and reminders must
 *     never sit in front of the customer's confirmation.
 */

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; code: "taken" | "expired" | "rule" | "denied"; message: string };

function fail(e: unknown): ActionResult<never> {
  if (isSlotTaken(e)) {
    return { ok: false, code: "taken", message: "That slot was just taken." };
  }
  if (e instanceof RuleViolation) {
    return {
      ok: false,
      code: e.code === "hold_expired" ? "expired" : "rule",
      message: e.message,
    };
  }
  throw e;
}

const createSchema = z.object({
  courtId: z.string().min(1),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startMinute: z.coerce.number().int().min(0).max(1200),
  durationMinutes: z.coerce.number().int().refine((n) => [60, 90, 120].includes(n)),
  customerId: z.string().nullable(),
  partySize: z.coerce.number().int().min(1).max(8).default(4),
  source: z.string().default("staff"),
  openMatch: z.boolean().default(false),
  hold: z.boolean().default(false),
  notes: z.string().default(""),
});

export async function createBooking(
  input: z.input<typeof createSchema>,
): Promise<ActionResult<{ id: string; serial: number }>> {
  const claims = await requireUser();
  const parsed = createSchema.parse(input);
  const db = getDb();

  const day = localDate(parsed.day);
  const start = instantAt(day, parsed.startMinute);
  const end = instantAt(day, parsed.startMinute + parsed.durationMinutes);

  const [courts, rules, customers] = await Promise.all([
    db.courts.list(),
    db.pricing.rules(),
    parsed.customerId ? db.customers.list() : Promise.resolve([]),
  ]);

  const court = courts.find((c) => c.id === parsed.courtId);
  if (!court) return { ok: false, code: "rule", message: "No such court." };

  const customer = customers.find((c) => c.id === parsed.customerId) ?? null;
  if (customer?.blocked) {
    return {
      ok: false,
      code: "rule",
      message: `${customer.name} is blocked: ${customer.blockedReason ?? "no reason recorded"}`,
    };
  }

  const q = quote({
    day,
    startMinute: parsed.startMinute,
    durationMinutes: parsed.durationMinutes,
    court,
    tier: customer?.tier ?? "guest",
    rules,
  });

  try {
    const booking = await db.bookings.create({
      courtId: parsed.courtId,
      start,
      end,
      status: parsed.hold ? "held" : "confirmed",
      source: parsed.source as BookingSource,
      customerId: parsed.customerId,
      partySize: parsed.partySize,
      priceLines: q.lines,
      createdBy: claims.userId,
      openMatch: parsed.openMatch,
      levelMin: parsed.openMatch ? (customer?.level ?? 3) - 0.5 : null,
      levelMax: parsed.openMatch ? (customer?.level ?? 3) + 1 : null,
      notes: parsed.notes,
    });

    if (customer) {
      await db.participants.add({
        bookingId: booking.id,
        customerId: customer.id,
        guestName: null,
        share: q.total,
        paid: fils(0),
        paidAt: null,
        isBooker: true,
      });
    }

    // The customer's confirmation must not wait on a WhatsApp round-trip.
    after(async () => {
      if (!customer) return;
      await db.notifications.queue({
        kind: "booking_confirmed",
        to: customer.phone,
        body: `Kagu Padel — ${court.name} on ${day} at ${parsed.startMinute}. Entry #${booking.serial}.`,
        bookingId: booking.id,
      });
    });

    revalidatePath("/[locale]/console/calendar", "page");
    return { ok: true, data: { id: booking.id, serial: booking.serial } };
  } catch (e) {
    return fail(e);
  }
}

const moveSchema = z.object({
  id: z.string().min(1),
  courtId: z.string().min(1),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startMinute: z.coerce.number().int().min(0).max(1200),
});

/**
 * Drag-to-move. The optimistic UI has already moved the slip; if this returns
 * `taken`, the client snaps it back along the same path and lands a stamp on
 * the origin.
 */
export async function moveBooking(
  input: z.input<typeof moveSchema>,
): Promise<ActionResult<{ id: string }>> {
  const claims = await requireUser();
  const parsed = moveSchema.parse(input);
  const db = getDb();

  try {
    const b = await db.bookings.move(
      parsed.id,
      parsed.courtId,
      instantAt(localDate(parsed.day), parsed.startMinute),
      claims.userId,
    );
    revalidatePath("/[locale]/console/calendar", "page");
    return { ok: true, data: { id: b.id } };
  } catch (e) {
    return fail(e);
  }
}

export async function confirmHold(id: string): Promise<ActionResult<{ id: string }>> {
  const claims = await requireUser();
  const db = getDb();
  try {
    const b = await db.bookings.confirmHold(id, claims.userId);
    revalidatePath("/[locale]/console/calendar", "page");
    return { ok: true, data: { id: b.id } };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelBooking(
  id: string,
  reason: string,
): Promise<ActionResult<{ refund: Fils; kind: string }>> {
  const claims = await requireUser();
  if (!can(claims.role, "cancel_booking")) {
    return { ok: false, code: "denied", message: "Not permitted." };
  }

  const db = getDb();
  const [booking, policies] = await Promise.all([
    db.bookings.get(id),
    db.policies.cancellation(),
  ]);
  if (!booking) return { ok: false, code: "rule", message: "No such entry." };

  const outcome = resolveCancellation(booking, policies);

  try {
    await db.bookings.cancel(id, claims.userId, reason, {
      amount: outcome.refundAmount,
      kind: outcome.refundKind,
    });

    after(async () => {
      if (!booking.customerId) return;
      const c = await db.customers.get(booking.customerId);
      if (!c) return;
      await db.notifications.queue({
        kind: "booking_cancelled",
        to: c.phone,
        body: `Kagu Padel — entry #${booking.serial} cancelled. ${outcome.explanation}`,
        bookingId: booking.id,
      });
    });

    revalidatePath("/[locale]/console/calendar", "page");
    return {
      ok: true,
      data: { refund: outcome.refundAmount, kind: outcome.refundKind },
    };
  } catch (e) {
    return fail(e);
  }
}

export async function markNoShow(id: string): Promise<ActionResult<{ id: string }>> {
  const claims = await requireUser();
  const db = getDb();
  try {
    const b = await db.bookings.markNoShow(id, claims.userId);
    revalidatePath("/[locale]/console/calendar", "page");
    return { ok: true, data: { id: b.id } };
  } catch (e) {
    return fail(e);
  }
}

const discountSchema = z.object({
  id: z.string().min(1),
  percent: z.coerce.number().min(0).max(100),
  reason: z.string().min(3, "A discount needs a reason — the audit log records it."),
});

export async function applyDiscount(
  input: z.input<typeof discountSchema>,
): Promise<ActionResult<{ total: Fils }>> {
  const claims = await requireUser();
  if (!can(claims.role, "apply_discount")) {
    return {
      ok: false,
      code: "denied",
      message: "Only a manager or the owner can apply a discount.",
    };
  }

  const parsed = discountSchema.parse(input);
  const db = getDb();

  const [booking, courts, rules, customers] = await Promise.all([
    db.bookings.get(parsed.id),
    db.courts.list(),
    db.pricing.rules(),
    db.customers.list(),
  ]);
  if (!booking) return { ok: false, code: "rule", message: "No such entry." };

  const court = courts.find((c) => c.id === booking.courtId)!;
  const customer = customers.find((c) => c.id === booking.customerId) ?? null;

  const q = quote({
    day: operatingDayOf(booking.start),
    startMinute: minutesOf(booking),
    durationMinutes: Math.round((booking.end.getTime() - booking.start.getTime()) / 60_000),
    court,
    tier: customer?.tier ?? "guest",
    rules,
    discount: {
      percent: parsed.percent,
      reason: parsed.reason,
      appliedBy: claims.userId,
    },
  });

  try {
    const updated = await db.bookings.setPriceLines(parsed.id, q.lines, claims.userId);
    revalidatePath("/[locale]/console/calendar", "page");
    return { ok: true, data: { total: updated.total } };
  } catch (e) {
    return fail(e);
  }
}

function minutesOf(booking: { start: Date }): number {
  const day = operatingDayOf(booking.start);
  return Math.round((booking.start.getTime() - instantAt(day, 0).getTime()) / 60_000);
}

export async function cancelSeriesInstances(
  ids: string[],
  reason: string,
): Promise<ActionResult<{ cancelled: number; conflicted: number }>> {
  const claims = await requireUser();
  if (!can(claims.role, "cancel_booking")) {
    return { ok: false, code: "denied", message: "Not permitted." };
  }
  const db = getDb();
  // One call for N rows. Looping a single-row mutation here was measured at
  // 6598ms for 20 rows on a sibling project; batched, 332ms.
  const res = await db.bookings.cancelMany(ids, claims.userId, reason);
  revalidatePath("/[locale]/console/calendar", "page");
  return {
    ok: true,
    data: { cancelled: res.cancelled.length, conflicted: res.conflicted.length },
  };
}
