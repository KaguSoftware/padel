"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/data";
import { can, requireUser } from "@/auth/guard";
import { fils } from "@/lib/money";
import { normalisePhone } from "@/lib/text";
import type { ActionResult } from "./bookings";

const createSchema = z.object({
  phone: z.string().min(6),
  name: z.string().min(1),
  nameAr: z.string().nullable().default(null),
  level: z.coerce.number().min(1).max(7).nullable().default(null),
  tier: z.enum(["guest", "member", "premium"]).default("guest"),
});

/**
 * Phone is the practical primary key — names are entered inconsistently, so
 * deduplication happens on the normalised number. Creating a customer on a
 * number that already exists returns the existing row rather than minting a
 * second one, which is how the club ends up with two Ahmeds.
 */
export async function createCustomer(
  input: z.input<typeof createSchema>,
): Promise<ActionResult<{ id: string; existing: boolean }>> {
  await requireUser();
  const parsed = createSchema.parse(input);
  const db = getDb();

  const phone = normalisePhone(parsed.phone);
  const existing = await db.customers.findByPhone(phone);
  if (existing) {
    return { ok: true, data: { id: existing.id, existing: true } };
  }

  const created = await db.customers.create({
    phone,
    name: parsed.name,
    nameAr: parsed.nameAr,
    email: null,
    level: parsed.level,
    tier: parsed.tier,
    creditBalance: fils(0),
    noShowCount: 0,
    totalSpend: fils(0),
    blocked: false,
    blockedReason: null,
    notes: "",
  });

  revalidatePath("/[locale]/admin/customers", "page");
  return { ok: true, data: { id: created.id, existing: false } };
}

export async function setCustomerBlocked(
  id: string,
  blocked: boolean,
  reason: string,
): Promise<ActionResult<{ id: string }>> {
  const claims = await requireUser();
  if (!can(claims.role, "cancel_booking")) {
    return { ok: false, code: "denied", message: "Not permitted." };
  }
  if (blocked && reason.trim().length < 3) {
    return {
      ok: false,
      code: "rule",
      message: "Blocking a member needs a reason — the audit log records it.",
    };
  }

  const db = getDb();
  await db.customers.setBlocked(id, blocked, reason, claims.userId);
  revalidatePath("/[locale]/admin/customers", "page");
  return { ok: true, data: { id } };
}

export async function adjustCredit(
  id: string,
  deltaFils: number,
  reason: string,
): Promise<ActionResult<{ id: string }>> {
  const claims = await requireUser();
  if (!can(claims.role, "apply_discount")) {
    return {
      ok: false,
      code: "denied",
      message: "Only a manager or the owner can move credit.",
    };
  }
  if (reason.trim().length < 3) {
    return { ok: false, code: "rule", message: "A credit adjustment needs a reason." };
  }

  const db = getDb();
  await db.customers.adjustCredit(id, fils(Math.round(deltaFils)), reason, claims.userId);
  revalidatePath("/[locale]/admin/customers", "page");
  return { ok: true, data: { id } };
}

export async function joinOpenMatch(
  bookingId: string,
  customerId: string,
): Promise<ActionResult<{ id: string }>> {
  await requireUser();
  const db = getDb();

  const [booking, participants] = await Promise.all([
    db.bookings.get(bookingId),
    db.participants.listForBooking(bookingId),
  ]);
  if (!booking) return { ok: false, code: "rule", message: "No such match." };

  try {
    const p = await db.participants.add({
      bookingId,
      customerId,
      guestName: null,
      // The share re-divides across everyone when the match fills; this is the
      // provisional figure until then.
      share: fils(Math.floor(booking.total / Math.max(booking.partySize, 1))),
      paid: fils(0),
      paidAt: null,
      isBooker: false,
    });

    if (participants.length + 1 >= booking.partySize && booking.customerId) {
      const booker = await db.customers.get(booking.customerId);
      if (booker) {
        await db.notifications.queue({
          kind: "match_filled",
          to: booker.phone,
          body: `Your match #${booking.serial} is full.`,
          bookingId,
        });
      }
    }

    revalidatePath("/[locale]/play/matches", "page");
    return { ok: true, data: { id: p.id } };
  } catch (e) {
    if (e instanceof Error && e.name === "RuleViolation") {
      return { ok: false, code: "rule", message: e.message };
    }
    throw e;
  }
}
