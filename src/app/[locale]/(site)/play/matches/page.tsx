import { getTranslations, setRequestLocale } from "next-intl/server";
import { getClaims } from "@/auth/claims";
import { loadMatchesPage } from "@/data/loaders";
import { canJoin, joinerQuote, openSeats } from "@/domain/split";
import { clock } from "@/lib/time";
import { MatchBoard, type MatchView } from "./MatchBoard";

export const dynamic = "force-dynamic";

/**
 * Open matches — the feature that separates this from a generic court booker.
 *
 * Two players book a court and list it at a level; two strangers join and the
 * cost divides four ways. On a club with a community this generates more
 * bookings than anything else in the build.
 */
export default async function MatchesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [data, claims, t] = await Promise.all([
    loadMatchesPage(),
    getClaims(),
    getTranslations(),
  ]);
  const ar = locale === "ar";

  const me = claims?.customerId
    ? (data.customers.find((c) => c.id === claims.customerId) ?? null)
    : null;

  const nameOf = (id: string | null) => {
    if (!id) return null;
    const c = data.customers.find((x) => x.id === id);
    return c ? (ar ? (c.nameAr ?? c.name) : c.name) : null;
  };

  const matches: MatchView[] = data.matches.map((b) => {
    const parts = data.participants.filter((p) => p.bookingId === b.id);
    const court = data.courts.find((c) => c.id === b.courtId);
    return {
      id: b.id,
      serial: b.serial,
      courtName: court ? (ar ? court.nameAr : court.name) : "—",
      day: b.operatingDay,
      startClock: clock(b.start),
      endClock: clock(b.end),
      seats: openSeats(b.partySize, parts.length),
      partySize: b.partySize,
      levelMin: b.levelMin,
      levelMax: b.levelMax,
      players: parts.map((p) => ({
        name: nameOf(p.customerId) ?? p.guestName ?? t("booking.guest"),
        isBooker: p.isBooker,
      })),
      yourShare: joinerQuote(b.total, b.partySize),
      eligible: me ? canJoin(me.level, b.levelMin, b.levelMax) : true,
      alreadyIn: me ? parts.some((p) => p.customerId === me.id) : false,
    };
  });

  return (
    <MatchBoard
      locale={locale}
      matches={matches}
      meId={me?.id ?? null}
      meLevel={me?.level ?? null}
      strings={{
        title: t("play.openMatches"),
        join: t("play.join"),
        yourLevel: t("play.yourLevel"),
        empty: t("common.empty"),
        booker: t("booking.booker"),
        signIn: t("nav.signIn"),
        levelBandLabel: ar ? "المستوى" : "Level",
        seatsLabel: ar ? "مقاعد متبقية" : "seats left",
        shareLabel: ar ? "حصتك" : "Your share",
        outOfBand: ar
          ? "هذه المباراة خارج نطاق مستواك."
          : "This match is outside your level band.",
        alreadyIn: ar ? "أنت في هذه المباراة" : "You're in this match",
      }}
    />
  );
}
