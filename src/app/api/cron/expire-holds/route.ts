import { NextResponse } from "next/server";
import { getDb } from "@/data";

/**
 * The hold sweep.
 *
 * A hold that is never confirmed must free its court, or the 21:00 slot on a
 * Thursday stays invisible-but-unbookable forever. In production this is
 * `pg_cron` calling the same SQL; this route exists so the behaviour is
 * exercisable on the memory driver and so Vercel Cron has something to hit
 * before the database lands.
 *
 * ⚠️ Idempotent by construction: expiring an already-expired hold is a no-op,
 * so running it twice inserts and changes nothing the second time.
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
  const expired = await db.bookings.expireHolds(new Date());

  return NextResponse.json({ expired, at: new Date().toISOString() });
}
