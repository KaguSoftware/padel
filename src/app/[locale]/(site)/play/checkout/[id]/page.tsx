import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { loadBookingDetail } from "@/data/loaders";
import { clock } from "@/lib/time";
import { Checkout } from "./Checkout";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const [detail, t] = await Promise.all([
    loadBookingDetail(id),
    getTranslations(),
  ]);
  if (!detail) notFound();

  const { booking, court, customer } = detail;
  const ar = locale === "ar";

  return (
    <Checkout
      locale={locale}
      booking={{
        id: booking.id,
        serial: booking.serial,
        status: booking.status,
        courtName: court ? (ar ? court.nameAr : court.name) : "—",
        day: booking.operatingDay,
        startClock: clock(booking.start),
        endClock: clock(booking.end),
        total: booking.total,
        partySize: booking.partySize,
        openMatch: booking.openMatch,
        holdExpiresAt: booking.holdExpiresAt?.toISOString() ?? null,
        holdIssuedAt: booking.createdAt.toISOString(),
        priceLines: booking.priceLines.map((l) => ({
          label: ar ? l.labelAr : l.label,
          amount: l.amount,
        })),
      }}
      customer={
        customer
          ? {
              name: ar ? (customer.nameAr ?? customer.name) : customer.name,
              phone: customer.phone,
              credit: customer.creditBalance,
            }
          : null
      }
      strings={{
        checkout: t("play.checkout"),
        payNow: t("play.payNow"),
        payAtDesk: t("play.payAtDesk"),
        confirmed: t("play.confirmed"),
        expired: t("play.expired"),
        total: t("booking.total"),
        credit: t("play.credit"),
        holdExplain: t("play.holdExplain", { minutes: 8 }),
        openMatch: t("booking.openMatch"),
        myBookings: t("play.myBookings"),
        back: t("common.back"),
      }}
    />
  );
}
