import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { loadConsoleDay } from "@/data/loaders";
import { NotAuthorised, requireAdmin } from "@/auth/guard";
import { cellKey, SLOT_STEP_MINUTES } from "@/domain/slots";
import { splitBooking } from "@/domain/split";
import { dirOf } from "@/i18n/routing";
import { instantAt, localDate, minutesIntoDay, todayInDubai } from "@/lib/time";
import { PageShell } from "@/ui/PageShell";
import { Board } from "./Board";
import { runsFromClosedMinutes } from "./geometry";
import type { Attention, CourtLane, DayMark, SlipView } from "./types";

export const dynamic = "force-dynamic";

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ d?: string }>;
}) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);

  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof NotAuthorised) redirect(`/${locale}/play`);
    throw e;
  }

  const day = sp.d ? localDate(sp.d) : todayInDubai();

  // ONE wave. Everything this page shows arrives together.
  const data = await loadConsoleDay(day);
  const [t, format] = await Promise.all([getTranslations("calendar"), getFormatter()]);
  const today = todayInDubai();
  const ar = locale === "ar";

  /**
   * The lanes.
   *
   * Closure is resolved PER BAND here and shipped as runs. The board used to
   * ask one question per court — "is there any open cell today?" — and hatch
   * the whole lane or none of it, so a shortened Ramadan window or a two-hour
   * maintenance block drew as fully open on a board whose server rejects every
   * write into it. The grid has always known the truth per cell; it simply
   * never crossed the RSC boundary. A `Map` cannot, so runs do.
   */
  const lanes: CourtLane[] = data.courts.map((c) => {
    const closure = data.closures.find((x) => x.courtId === c.id);
    const closedMinutes = data.grid.rowMinutes.filter(
      (m) => data.grid.cells.get(cellKey(c.id, m))?.state === "closed",
    );
    return {
      id: c.id,
      name: ar ? c.nameAr : c.name,
      enclosure: c.enclosure,
      closedNote: closure ? (ar ? closure.noteAr : closure.note) : null,
      closedRuns: runsFromClosedMinutes(closedMinutes, SLOT_STEP_MINUTES),
      shut: closedMinutes.length === data.grid.rowMinutes.length,
    };
  });

  const participantsByBooking = new Map<string, typeof data.participants>();
  for (const p of data.participants) {
    const list = participantsByBooking.get(p.bookingId) ?? [];
    list.push(p);
    participantsByBooking.set(p.bookingId, list);
  }

  const customerById = new Map(data.customers.map((c) => [c.id, c]));

  const slips: SlipView[] = data.bookings.map((b) => {
    const parts = participantsByBooking.get(b.id) ?? [];
    const split = splitBooking(b.total, parts);
    const customer = b.customerId ? customerById.get(b.customerId) : undefined;
    return {
      id: b.id,
      serial: b.serial,
      courtId: b.courtId,
      startMinute: minutesIntoDay(b.start, day),
      durationMinutes: Math.round((b.end.getTime() - b.start.getTime()) / 60_000),
      status: b.status,
      paymentStatus: b.paymentStatus,
      source: b.source,
      openMatch: b.openMatch,
      partySize: b.partySize,
      participantCount: parts.length,
      customerName: customer ? (ar ? (customer.nameAr ?? customer.name) : customer.name) : "",
      customerPhone: customer?.phone ?? "",
      total: b.total,
      outstanding: split.outstanding,
      holdExpiresAt: b.holdExpiresAt ? b.holdExpiresAt.toISOString() : null,
      holdIssuedAt: b.holdExpiresAt ? b.createdAt.toISOString() : null,
      isSeries: b.seriesId !== null,
      blockReason: b.blockReason,
    };
  });

  /**
   * What the board flags. Counted here, on the rows, so the filter chips carry
   * their number before a single card has been measured in the browser.
   */
  const attention: Attention = {
    holds: slips.filter((s) => s.status === "held").length,
    unpaid: slips.filter(
      (s) => s.outstanding > 0 && (s.status === "confirmed" || s.status === "held"),
    ).length,
    seats: slips.filter((s) => s.openMatch && s.participantCount < s.partySize).length,
    blocked: slips.filter((s) => s.status === "blocked").length,
  };

  // Weekday and date come out of the request's locale, not a hand-rolled table.
  const week: DayMark[] = data.week.map((w) => {
    const noon = instantAt(w.day, 6 * 60);
    return {
      day: w.day,
      weekday: format.dateTime(noon, { weekday: "short", timeZone: "Asia/Dubai" }),
      dayOfMonth: format.dateTime(noon, { day: "numeric", timeZone: "Asia/Dubai" }),
      utilisation: w.utilisation,
      isToday: w.day === today,
    };
  });

  return (
    <PageShell
      title={t("title")}
      serial={format.dateTime(instantAt(day, 6 * 60), {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "Asia/Dubai",
      })}
      bleed
    >
      <Board
        locale={locale}
        dir={dirOf(locale)}
        day={day}
        today={today}
        week={week}
        lanes={lanes}
        rowMinutes={data.grid.rowMinutes}
        step={SLOT_STEP_MINUTES}
        slips={slips}
        customers={data.customers.map((c) => ({
          id: c.id,
          name: ar ? (c.nameAr ?? c.name) : c.name,
          altName: ar ? c.name : (c.nameAr ?? ""),
          phone: c.phone,
          tier: c.tier,
          level: c.level,
          blocked: c.blocked,
        }))}
        takings={data.takings}
        dueCount={data.dueCount}
        utilisation={data.utilisation}
        attention={attention}
      />
    </PageShell>
  );
}
