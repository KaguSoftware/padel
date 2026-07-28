import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSessionClaims } from "@/auth/claims";
import { loadAccountPage } from "@/data/loaders";
import { resolveCancellation } from "@/domain/cancellation";
import { formatMoney } from "@/lib/money";
import { clock } from "@/lib/time";
import { Link } from "@/i18n/routing";
import { Cell, LedgerRow, LedgerTable } from "@/ui/PageShell";
import { CourtLines } from "@/ui/court";
import { EmptyLine, Reading, Serial } from "@/ui/primitives";
import { paymentStamp, Stamp } from "@/ui/Stamp";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [claims, t] = await Promise.all([getSessionClaims(), getTranslations()]);
  const ar = locale === "ar";

  // No player identity on this session — either signed out, or signed in as
  // someone who works here. Both want the same thing next: a way in.
  if (!claims?.customerId) {
    return (
      <main className="court-world court-surface min-h-dvh">
        <div className="mx-auto w-full max-w-2xl px-4 py-16">
          <h1 className="painted text-[32px] leading-none text-line">
            {t("nav.account")}
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-line/80">
            {ar
              ? "سجّل الدخول لعرض حجوزاتك ومبارياتك ورصيدك."
              : "Sign in to see your entries, your matches and what you owe."}
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/account/sign-in"
              className="live-block inline-flex min-h-12 items-center px-6 font-stadium text-[12px] uppercase tracking-[0.09em] transition-[filter] duration-100 hover:brightness-110"
            >
              {ar ? "دخول" : "Sign in"}
            </Link>
            <Link
              href="/account/sign-up"
              className="inline-flex min-h-12 items-center border border-line/35 px-6 font-stadium text-[12px] uppercase tracking-[0.09em] text-line transition-colors hover:border-line hover:bg-line/10"
            >
              {ar ? "أنشئ حساباً" : "Create an account"}
            </Link>
          </div>

          {claims && (
            <p className="mt-8 font-board text-[11px] uppercase tracking-[0.14em] text-line-dim">
              {ar ? "أنت الآن" : "Signed in as"} {claims.name} ·{" "}
              <Link href="/admin/calendar" className="text-amber hover:underline">
                {t("nav.admin")}
              </Link>
            </p>
          )}
        </div>
      </main>
    );
  }

  const data = await loadAccountPage(claims.customerId);
  if (!data.customer) {
    return (
      <main className="court-world court-surface min-h-dvh px-4 py-16">
        <EmptyLine>{t("common.empty")}</EmptyLine>
      </main>
    );
  }

  const c = data.customer;
  const courtName = (id: string) => {
    const court = data.courts.find((x) => x.id === id);
    return court ? (ar ? court.nameAr : court.name) : "—";
  };

  // Read the clock ONCE so the two lists are partitioned against the same
  // instant. Sampling it per row can drop or duplicate a booking that crosses
  // the boundary while the list is being built.
  //
  // `react-hooks/purity` is aimed at client components that re-render; this is
  // an async Server Component that runs once per request, and the request time
  // IS the correct instant to partition against.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const upcoming = data.bookings.filter(
    (b) =>
      b.start.getTime() > now &&
      (b.status === "confirmed" || b.status === "held"),
  );
  const past = data.bookings.filter((b) => b.start.getTime() <= now);

  return (
    <main className="court-world court-surface min-h-dvh">
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        {/* The member card, as a card. */}
        <section className="board-panel relative overflow-hidden p-6">
          <CourtLines className="pointer-events-none absolute inset-x-6 bottom-5 h-14 w-auto text-line/12" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-board text-[11px] uppercase tracking-[0.14em] text-amber">
                Kagu Padel ·{" "}
                {t(`customer.tiers.${c.tier}` as "customer.tiers.member")}
              </p>
              <h1 className="mt-1 painted text-[36px] leading-none text-line">
                {ar ? (c.nameAr ?? c.name) : c.name}
              </h1>
            </div>
            <Serial value={`No. ${c.id.replace(/\D/g, "").padStart(6, "0")}`} />
          </div>

          <dl className="relative mt-6 grid grid-cols-2 gap-6 border-t-2 border-line/25 pt-4 sm:grid-cols-4">
            <Reading
              label={t("play.credit")}
              value={formatMoney(c.creditBalance, locale, { showCurrency: false })}
              tone={c.creditBalance > 0 ? "settle" : "ink"}
            />
            <Reading
              label={t("play.yourLevel")}
              value={c.level === null ? t("customer.unrated") : String(c.level)}
            />
            <Reading
              label={t("customer.spend")}
              value={formatMoney(c.totalSpend, locale, { showCurrency: false })}
            />
            <Reading
              label={t("customer.noShows")}
              value={String(c.noShowCount)}
              tone={c.noShowCount > 2 ? "rule" : "ink"}
            />
          </dl>
        </section>

        <section className="mt-10">
          <h2 className="border-b-2 border-line/25 pb-2 painted text-[24px] leading-none text-line">
            {t("play.myBookings")}
          </h2>

          {upcoming.length === 0 ? (
            <div className="mt-4">
              <EmptyLine>{t("common.empty")}</EmptyLine>
            </div>
          ) : (
            <LedgerTable
              className="mt-3"
              heads={["", t("booking.court"), t("booking.when"), t("booking.total"), ""]}
            >
              {upcoming.map((b) => {
                const outcome = resolveCancellation(b, data.policies);
                const stamp = paymentStamp(b.paymentStatus);
                return (
                  <LedgerRow key={b.id}>
                    <Cell>
                      <Serial value={b.serial} />
                    </Cell>
                    <Cell className="font-semibold">{courtName(b.courtId)}</Cell>
                    <Cell className="font-board text-[12px] tabular-nums">
                      {b.operatingDay} {clock(b.start)}
                      {b.seriesId && (
                        <span className="ms-2 text-amber">
                          ↻ {t("play.weeklySlot")}
                        </span>
                      )}
                    </Cell>
                    <Cell numeric>
                      {formatMoney(b.total, locale, { showCurrency: false })}
                    </Cell>
                    <Cell>
                      <span className="flex flex-wrap items-center gap-2">
                        <Stamp tone={stamp.tone}>
                          {t(`status.${stamp.key}` as "status.paid")}
                        </Stamp>
                        <span
                          className="font-board text-[11px] text-line/60"
                          title={
                            ar ? outcome.explanationAr : outcome.explanation
                          }
                        >
                          {t("play.cancelPolicy", {
                            outcome: t(
                              `pricing.outcomes.${outcome.refundKind}` as "pricing.outcomes.refund",
                            ),
                          })}
                        </span>
                      </span>
                    </Cell>
                  </LedgerRow>
                );
              })}
            </LedgerTable>
          )}
        </section>

        {past.length > 0 && (
          <section className="mt-10">
            <h2 className="border-b border-line/20 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-line-dim">
              {t("customer.history")}
            </h2>
            <LedgerTable
              className="mt-2"
              heads={["", t("booking.court"), t("booking.when"), t("booking.total"), ""]}
            >
              {past.slice(0, 20).map((b) => {
                const stamp = paymentStamp(b.paymentStatus);
                return (
                  <LedgerRow key={b.id} className="opacity-80">
                    <Cell>
                      <Serial value={b.serial} />
                    </Cell>
                    <Cell>{courtName(b.courtId)}</Cell>
                    <Cell className="font-board text-[12px] tabular-nums">
                      {b.operatingDay} {clock(b.start)}
                    </Cell>
                    <Cell numeric>
                      {formatMoney(b.total, locale, { showCurrency: false })}
                    </Cell>
                    <Cell>
                      {b.status === "no_show" ? (
                        <Stamp tone="noshow">{t("status.noShow")}</Stamp>
                      ) : (
                        <Stamp tone={stamp.tone}>
                          {t(`status.${stamp.key}` as "status.paid")}
                        </Stamp>
                      )}
                    </Cell>
                  </LedgerRow>
                );
              })}
            </LedgerTable>
          </section>
        )}
      </div>
    </main>
  );
}
