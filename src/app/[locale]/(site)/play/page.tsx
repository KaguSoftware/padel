import { getTranslations, setRequestLocale } from "next-intl/server";
import { getClaims } from "@/auth/claims";
import { getDb } from "@/data";
import { rowsOrThrow } from "@/data/query";
import { loadPlayDay } from "@/data/loaders";
import { bookableByCourt } from "@/domain/slots";
import { quote } from "@/domain/pricing";
import { addDaysToLocalDate, localDate, todayInDubai } from "@/lib/time";
import { BookFlow, type CourtOffer } from "./BookFlow";

export const dynamic = "force-dynamic";

const DURATIONS = [60, 90, 120];

export default async function PlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ d?: string; mins?: string }>;
}) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);

  const day = sp.d ? localDate(sp.d) : todayInDubai();
  const duration = DURATIONS.includes(Number(sp.mins)) ? Number(sp.mins) : 90;

  const db = getDb();
  const [data, claims, customers, t] = await Promise.all([
    loadPlayDay(day),
    getClaims(),
    rowsOrThrow("play.customers", db.customers.list()),
    getTranslations(),
  ]);

  const me = claims?.customerId
    ? (customers.find((c) => c.id === claims.customerId) ?? null)
    : null;
  const tier = me?.tier ?? "guest";
  const ar = locale === "ar";

  const bookable = bookableByCourt(data.grid, duration);

  // Every offered slot carries its real price, computed by the same engine the
  // front desk uses — a player must never be quoted one figure and charged
  // another at the counter.
  const offers: CourtOffer[] = data.courts.map((court) => ({
    id: court.id,
    name: ar ? court.nameAr : court.name,
    enclosure: t(
      `courts.enclosures.${court.enclosure}` as "courts.enclosures.indoor",
    ),
    surface: t(`courts.surfaces.${court.surface}` as "courts.surfaces.glass"),
    slots: (bookable.get(court.id) ?? []).map((startMinute) => ({
      startMinute,
      price: quote({
        day,
        startMinute,
        durationMinutes: duration,
        court,
        tier,
        rules: data.rules,
      }).total,
    })),
  }));

  return (
    <BookFlow
      locale={locale}
      day={day}
      prevDay={addDaysToLocalDate(day, -1)}
      nextDay={addDaysToLocalDate(day, 1)}
      today={todayInDubai()}
      duration={duration}
      durations={DURATIONS}
      offers={offers}
      me={
        me
          ? {
              id: me.id,
              name: ar ? (me.nameAr ?? me.name) : me.name,
              tier: me.tier,
              level: me.level,
              credit: me.creditBalance,
            }
          : null
      }
      strings={{
        findCourt: t("play.findCourt"),
        when: t("play.when"),
        duration: t("play.duration"),
        noSlots: t("play.noSlots"),
        hold: t("play.hold"),
        holdExplain: t("play.holdExplain", { minutes: 8 }),
        today: t("calendar.today"),
        previous: t("calendar.previous"),
        next: t("calendar.next"),
        credit: t("play.credit"),
        taken: t("play.taken"),
        yourLevel: t("play.yourLevel"),
        openMatch: t("booking.openMatch"),
        signIn: t("nav.signIn"),
      }}
    />
  );
}
