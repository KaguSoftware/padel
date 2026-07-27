import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { loadConsoleDay } from "@/data/loaders";
import { NotAuthorised, requireConsole } from "@/auth/guard";
import { SLOT_STEP_MINUTES } from "@/domain/slots";
import { splitBooking } from "@/domain/split";
import {
  addDaysToLocalDate,
  localDate,
  minutesIntoDay,
  todayInDubai,
} from "@/lib/time";
import { DayBook, type CourtColumn, type SlipView } from "./DayBook";

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
    await requireConsole();
  } catch (e) {
    if (e instanceof NotAuthorised) redirect(`/${locale}/play`);
    throw e;
  }

  const day = sp.d ? localDate(sp.d) : todayInDubai();

  // ONE wave. Everything this page shows arrives together.
  const data = await loadConsoleDay(day);
  const t = await getTranslations();

  // The grid's Map is not serialisable across the RSC boundary, so the view
  // model is assembled here — on the server, where the rows already are —
  // rather than shipping raw data and recomputing it in the browser.
  const columns: CourtColumn[] = data.courts.map((c) => {
    const closure = data.closures.find((x) => x.courtId === c.id);
    const open = data.grid.rowMinutes.some(
      (m) => data.grid.cells.get(`${c.id}:${m}`)?.state !== "closed",
    );
    return {
      id: c.id,
      name: locale === "ar" ? c.nameAr : c.name,
      tags: c.tags,
      enclosure: c.enclosure,
      closedNote: closure ? (locale === "ar" ? closure.noteAr : closure.note) : null,
      hasWindow: open,
    };
  });

  const participantsByBooking = new Map<string, typeof data.participants>();
  for (const p of data.participants) {
    const list = participantsByBooking.get(p.bookingId) ?? [];
    list.push(p);
    participantsByBooking.set(p.bookingId, list);
  }

  const customerName = new Map(
    data.customers.map((c) => [c.id, locale === "ar" ? (c.nameAr ?? c.name) : c.name]),
  );

  const slips: SlipView[] = data.bookings.map((b) => {
    const parts = participantsByBooking.get(b.id) ?? [];
    const split = splitBooking(b.total, parts);
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
      customerName: b.customerId ? (customerName.get(b.customerId) ?? "") : "",
      total: b.total,
      outstanding: split.outstanding,
      holdExpiresAt: b.holdExpiresAt ? b.holdExpiresAt.toISOString() : null,
      holdIssuedAt: b.holdExpiresAt ? b.createdAt.toISOString() : null,
      isSeries: b.seriesId !== null,
      blockReason: b.blockReason,
      levelMin: b.levelMin,
      levelMax: b.levelMax,
    };
  });

  return (
    <DayBook
      locale={locale}
      day={day}
      prevDay={addDaysToLocalDate(day, -1)}
      nextDay={addDaysToLocalDate(day, 1)}
      today={todayInDubai()}
      columns={columns}
      rowMinutes={data.grid.rowMinutes}
      step={SLOT_STEP_MINUTES}
      slips={slips}
      customers={data.customers.map((c) => ({
        id: c.id,
        name: locale === "ar" ? (c.nameAr ?? c.name) : c.name,
        altName: locale === "ar" ? c.name : (c.nameAr ?? ""),
        phone: c.phone,
        tier: c.tier,
        level: c.level,
        blocked: c.blocked,
      }))}
      takings={data.takings}
      dueCount={data.dueCount}
      utilisation={Object.fromEntries(data.utilisationByHour)}
      strings={{
        title: t("calendar.title"),
        today: t("calendar.today"),
        previous: t("calendar.previous"),
        next: t("calendar.next"),
        closed: t("calendar.closed"),
        utilisation: t("calendar.utilisation"),
        takings: t("calendar.takings"),
        outstanding: t("calendar.outstanding"),
        justTaken: t("calendar.justTaken"),
        moved: t("calendar.moved"),
        moveFailed: t("calendar.moveFailed"),
        noCourts: t("calendar.noCourts"),
        page: t("calendar.page"),
        entry: {
          verb: t("entryLine.verb"),
          court: t("entryLine.court"),
          customer: t("entryLine.customer"),
          time: t("entryLine.time"),
          duration: t("entryLine.duration"),
          pickCourt: t("entryLine.pickCourt"),
          pickCustomer: t("entryLine.pickCustomer"),
          pickTime: t("entryLine.pickTime"),
          pickDuration: t("entryLine.pickDuration"),
          commit: t("entryLine.commit"),
          clear: t("entryLine.clear"),
          cannotParse: t("entryLine.cannotParse"),
        },
        status: {
          held: t("status.held"),
          confirmed: t("status.confirmed"),
          paid: t("status.paid"),
          due: t("status.due"),
          partPaid: t("status.partPaid"),
          noShow: t("status.noShow"),
          blocked: t("status.blocked"),
          cancelled: t("status.cancelled"),
          expired: t("status.expired"),
          openSeats: t("status.openSeats", { count: 0 }).replace("0", "{n}"),
        },
      }}
    />
  );
}
