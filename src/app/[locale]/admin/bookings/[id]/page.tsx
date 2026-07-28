import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getClaims } from "@/auth/claims";
import { can, requireAdmin } from "@/auth/guard";
import { loadBookingDetail } from "@/data/loaders";
import { clock, minutesIntoDay, operatingDayOf } from "@/lib/time";
import { BookingRecord } from "./BookingRecord";

export const dynamic = "force-dynamic";

export default async function BookingPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireAdmin();

  const [detail, claims, t] = await Promise.all([
    loadBookingDetail(id),
    getClaims(),
    getTranslations(),
  ]);
  if (!detail) notFound();

  const { booking, court, customer, participants, customers, payments, split, cancellation } =
    detail;

  const day = operatingDayOf(booking.start);
  const nameOf = (cid: string | null) => {
    if (!cid) return null;
    const c = customers.find((x) => x.id === cid);
    if (!c) return null;
    return locale === "ar" ? (c.nameAr ?? c.name) : c.name;
  };
  const staffName = (uid: string) => {
    const s = detail.staff.find((x) => x.id === uid);
    return s ? (locale === "ar" ? s.nameAr : s.name) : uid;
  };

  return (
    <BookingRecord
      locale={locale}
      booking={{
        id: booking.id,
        serial: booking.serial,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        source: booking.source,
        courtName: court ? (locale === "ar" ? court.nameAr : court.name) : "—",
        day,
        startClock: clock(booking.start),
        endClock: clock(booking.end),
        startMinute: minutesIntoDay(booking.start, day),
        durationMinutes: Math.round(
          (booking.end.getTime() - booking.start.getTime()) / 60_000,
        ),
        customerName: nameOf(booking.customerId),
        partySize: booking.partySize,
        openMatch: booking.openMatch,
        levelMin: booking.levelMin,
        levelMax: booking.levelMax,
        isSeries: booking.seriesId !== null,
        notes: booking.notes,
        createdBy: staffName(booking.createdBy),
        createdAt: booking.createdAt.toISOString(),
        total: booking.total,
        blockReason: booking.blockReason,
        cancellationReason: booking.cancellationReason,
        priceLines: booking.priceLines.map((l) => ({
          code: l.code,
          label: locale === "ar" ? l.labelAr : l.label,
          amount: l.amount,
          reason: l.reason ?? null,
          appliedBy: l.appliedBy ? staffName(l.appliedBy) : null,
        })),
      }}
      shares={split.shares.map((s) => ({
        participantId: s.participantId,
        name:
          nameOf(s.customerId) ??
          participants.find((p) => p.id === s.participantId)?.guestName ??
          t("booking.guest"),
        share: s.share,
        paid: s.paid,
        outstanding: s.outstanding,
        settled: s.settled,
        isBooker: s.isBooker,
      }))}
      collected={split.collected}
      outstanding={split.outstanding}
      payments={payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        method: p.method,
        takenBy: staffName(p.takenBy),
        takenAt: p.takenAt.toISOString(),
        isRefund: p.refundOf !== null,
      }))}
      cancellation={{
        hoursBefore: Math.round(cancellation.hoursBefore * 10) / 10,
        refundAmount: cancellation.refundAmount,
        refundKind: cancellation.refundKind,
        explanation:
          locale === "ar" ? cancellation.explanationAr : cancellation.explanation,
      }}
      permissions={{
        discount: can(claims?.role ?? "player", "apply_discount"),
        cancel: can(claims?.role ?? "player", "cancel_booking"),
        payment: can(claims?.role ?? "player", "take_payment"),
      }}
      customerCredit={customer?.creditBalance ?? null}
      strings={{
        title: t("booking.title", { serial: booking.serial }),
        court: t("booking.court"),
        when: t("booking.when"),
        duration: t("booking.duration"),
        source: t("booking.source"),
        createdBy: t("booking.createdBy"),
        participants: t("booking.participants"),
        price: t("booking.price"),
        total: t("booking.total"),
        payments: t("booking.payments"),
        notes: t("booking.notes"),
        cancel: t("booking.cancel"),
        confirm: t("booking.confirm"),
        markNoShow: t("booking.markNoShow"),
        discount: t("booking.discount"),
        discountReason: t("booking.discountReason"),
        takePayment: t("booking.takePayment"),
        settleAll: t("booking.settleAll"),
        share: t("booking.share"),
        paid: t("booking.paid"),
        owes: t("booking.owes"),
        booker: t("booking.booker"),
        openMatch: t("booking.openMatch"),
        level: t("booking.level"),
        credit: t("customer.credit"),
        empty: t("common.empty"),
        save: t("common.save"),
        sources: {
          web: t("booking.sources.web"),
          walk_in: t("booking.sources.walk_in"),
          phone: t("booking.sources.phone"),
          staff: t("booking.sources.staff"),
          recurring: t("booking.sources.recurring"),
          class: t("booking.sources.class"),
          tournament: t("booking.sources.tournament"),
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
        },
      }}
    />
  );
}
