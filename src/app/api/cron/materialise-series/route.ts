import { NextResponse } from "next/server";
import { getDb } from "@/data";
import { SlotTakenError } from "@/domain/errors";
import {
  expandSeries,
  instancesToMaterialise,
  materialisationWindow,
} from "@/domain/recurrence";
import { quote } from "@/domain/pricing";
import { todayInDubai } from "@/lib/time";

/**
 * Roll the recurring-series window forward.
 *
 * The same four players at 21:00 every Tuesday for a year is a large share of
 * this club's revenue, and the instances that represent it are materialised on
 * a rolling 56-day window rather than stored for eternity.
 *
 * ⚠️ IDEMPOTENCE IS THE WHOLE CONTRACT. A sweep that is not idempotent
 * duplicates every Tuesday 21:00 in the club within a week.
 * `instancesToMaterialise` filters against what already exists, and the
 * exclusion constraint catches anything that slips through — a conflict here is
 * counted and skipped, never retried into a duplicate.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorised" }, { status: 401 });
    }
  }

  const db = getDb();
  const today = todayInDubai();
  const window = materialisationWindow(today);

  const [series, exceptions, existing, courts, rules, customers] =
    await Promise.all([
      db.series.list(),
      db.series.exceptions(),
      db.bookings.listForRange(window.from, window.to),
      db.courts.list(),
      db.pricing.rules(),
      db.customers.list(),
    ]);

  const planned = series.flatMap((s) =>
    expandSeries(s, window.from, window.to, exceptions),
  );
  const todo = instancesToMaterialise(planned, existing);

  let created = 0;
  let conflicted = 0;

  for (const instance of todo) {
    const court = courts.find((c) => c.id === instance.courtId);
    if (!court) continue;
    const customer = customers.find((c) => c.id === instance.customerId);

    const startMinute = Math.round(
      (instance.start.getTime() -
        new Date(`${instance.day}T02:00:00.000Z`).getTime()) /
        60_000,
    );
    const durationMinutes = Math.round(
      (instance.end.getTime() - instance.start.getTime()) / 60_000,
    );

    const q = quote({
      day: instance.day,
      startMinute,
      durationMinutes,
      court,
      tier: customer?.tier ?? "member",
      rules,
    });

    try {
      await db.bookings.create({
        courtId: instance.courtId,
        start: instance.start,
        end: instance.end,
        status: "confirmed",
        source: "recurring",
        customerId: instance.customerId,
        partySize: instance.partySize,
        priceLines: q.lines,
        createdBy: "usr-manager",
        seriesId: instance.seriesId,
      });
      created++;
    } catch (e) {
      if (e instanceof SlotTakenError) {
        // The slot was taken by someone else in the meantime. That is a real
        // operational event, not an error to retry — the club has to move the
        // series or talk to the customer.
        conflicted++;
      } else {
        throw e;
      }
    }
  }

  return NextResponse.json({
    window,
    planned: planned.length,
    created,
    conflicted,
    at: new Date().toISOString(),
  });
}
