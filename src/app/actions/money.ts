"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { getDb } from "@/data";
import type { PaymentMethod } from "@/data/types";
import { can, requireUser } from "@/auth/guard";
import { RuleViolation } from "@/domain/errors";
import { splitBooking } from "@/domain/split";
import { fils, type Fils } from "@/lib/money";
import { localDate, todayInDubai } from "@/lib/time";
import type { ActionResult } from "./bookings";

const takeSchema = z.object({
  bookingId: z.string().nullable(),
  saleId: z.string().nullable(),
  participantId: z.string().nullable(),
  amountFils: z.coerce.number().int().positive(),
  method: z.enum(["cash", "card", "wallet", "credit", "transfer"]),
  note: z.string().default(""),
});

export async function takePayment(
  input: z.input<typeof takeSchema>,
): Promise<ActionResult<{ id: string }>> {
  const claims = await requireUser();
  if (!can(claims.role, "take_payment")) {
    return { ok: false, code: "denied", message: "Not permitted." };
  }

  const parsed = takeSchema.parse(input);
  const db = getDb();
  const session = await db.till.currentSession();

  const payment = await db.payments.take({
    bookingId: parsed.bookingId,
    saleId: parsed.saleId,
    participantId: parsed.participantId,
    amount: fils(parsed.amountFils),
    method: parsed.method as PaymentMethod,
    takenBy: claims.userId,
    takenAt: new Date(),
    tillSessionId: session?.id ?? null,
    refundOf: null,
    note: parsed.note,
  });

  if (parsed.participantId) {
    await db.participants.recordPayment(
      parsed.participantId,
      fils(parsed.amountFils),
      new Date(),
    );
  }

  revalidatePath("/[locale]/console/calendar", "page");
  revalidatePath("/[locale]/console/finances/till", "page");
  return { ok: true, data: { id: payment.id } };
}

/** Settle every outstanding share in one round-trip, not one call per player. */
export async function settleAllShares(
  bookingId: string,
  method: PaymentMethod,
): Promise<ActionResult<{ settled: number; amount: Fils }>> {
  const claims = await requireUser();
  if (!can(claims.role, "take_payment")) {
    return { ok: false, code: "denied", message: "Not permitted." };
  }

  const db = getDb();
  const [booking, participants, session] = await Promise.all([
    db.bookings.get(bookingId),
    db.participants.listForBooking(bookingId),
    db.till.currentSession(),
  ]);
  if (!booking) return { ok: false, code: "rule", message: "No such entry." };

  const split = splitBooking(booking.total, participants);
  const unpaid = split.shares.filter((s) => !s.settled);
  if (unpaid.length === 0) {
    return { ok: true, data: { settled: 0, amount: fils(0) } };
  }

  await db.participants.settleMany(
    unpaid.map((s) => s.participantId),
    new Date(),
  );

  await db.payments.take({
    bookingId,
    saleId: null,
    participantId: null,
    amount: split.outstanding,
    method,
    takenBy: claims.userId,
    takenAt: new Date(),
    tillSessionId: session?.id ?? null,
    refundOf: null,
    note: `Settled ${unpaid.length} shares`,
  });

  revalidatePath("/[locale]/console/calendar", "page");
  return { ok: true, data: { settled: unpaid.length, amount: split.outstanding } };
}

export async function openTill(
  openingFloatFils: number,
): Promise<ActionResult<{ id: string }>> {
  const claims = await requireUser();
  const db = getDb();
  try {
    const s = await db.till.open(
      todayInDubai(),
      fils(Math.round(openingFloatFils)),
      claims.userId,
    );
    revalidatePath("/[locale]/console/finances/till", "page");
    return { ok: true, data: { id: s.id } };
  } catch (e) {
    if (e instanceof RuleViolation) {
      return { ok: false, code: "rule", message: e.message };
    }
    throw e;
  }
}

const closeSchema = z.object({
  id: z.string().min(1),
  countedFils: z.coerce.number().int().min(0),
  note: z.string().default(""),
});

export async function closeTill(
  input: z.input<typeof closeSchema>,
): Promise<ActionResult<{ variance: Fils }>> {
  const claims = await requireUser();
  if (!can(claims.role, "close_till")) {
    return { ok: false, code: "denied", message: "Not permitted." };
  }
  const parsed = closeSchema.parse(input);
  const db = getDb();

  const session = await db.till.close(
    parsed.id,
    fils(parsed.countedFils),
    parsed.note,
    claims.userId,
  );

  revalidatePath("/[locale]/console/finances/till", "page");
  return { ok: true, data: { variance: session.variance ?? fils(0) } };
}

const saleSchema = z.object({
  bookingId: z.string().nullable(),
  customerId: z.string().nullable(),
  lines: z.array(
    z.object({
      productId: z.string(),
      qty: z.coerce.number().int().positive(),
      unitPriceFils: z.coerce.number().int().min(0),
    }),
  ).min(1),
});

export async function recordSale(
  input: z.input<typeof saleSchema>,
): Promise<ActionResult<{ serial: number }>> {
  const claims = await requireUser();
  if (!can(claims.role, "take_payment")) {
    return { ok: false, code: "denied", message: "Not permitted." };
  }
  const parsed = saleSchema.parse(input);
  const db = getDb();

  const sale = await db.sales.create({
    bookingId: parsed.bookingId,
    customerId: parsed.customerId,
    soldBy: claims.userId,
    day: localDate(todayInDubai()),
    lines: parsed.lines.map((l) => ({
      productId: l.productId,
      qty: l.qty,
      unitPrice: fils(l.unitPriceFils),
      amount: fils(l.unitPriceFils * l.qty),
    })),
  });

  after(async () => {
    // Low-stock check runs after the response — the counter never waits on it.
    const products = await db.products.list();
    for (const p of products) {
      if (p.stock !== null && p.lowStockAt !== null && p.stock <= p.lowStockAt) {
        await db.audit.append({
          actorId: claims.userId,
          action: "stock.low",
          entity: "product",
          entityId: p.id,
          summary: `${p.name} is at ${p.stock}, at or below its reorder point`,
          summaryAr: `${p.nameAr} وصل إلى ${p.stock}`,
          amount: null,
          reason: null,
        });
      }
    }
  });

  revalidatePath("/[locale]/console/shop", "page");
  return { ok: true, data: { serial: sale.serial } };
}
