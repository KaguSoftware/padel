import { getTranslations, setRequestLocale } from "next-intl/server";
import { getClaims } from "@/auth/claims";
import { allowManager, MANAGER_ROLES } from "@/auth/guard";
import { Denied } from "@/ui/Denied";
import { loadReportsPage } from "@/data/loaders";
import { addFils, formatMoney, type Fils, ZERO } from "@/lib/money";
import { addDaysToLocalDate, minutesIntoDay, operatingDayOf, todayInDubai } from "@/lib/time";
import { Link } from "@/i18n/routing";
import { Cell, LedgerRow, LedgerTable, PageShell } from "@/ui/PageShell";
import { Panel, Reading } from "@/ui/primitives";
import { UtilisationBars } from "./UtilisationBars";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const claims = await allowManager();

  if (!claims) {
    const t = await getTranslations();
    return (
      <Denied
        title={t("reports.title")}
        needs={MANAGER_ROLES}
        have={(await getClaims())?.role ?? null}
        roleLabels={{
          owner: t("common.roles.owner"),
          manager: t("common.roles.manager"),
          staff: t("common.roles.staff"),
          coach: t("common.roles.coach"),
          player: t("common.roles.player"),
        }}
      />
    );
  }

  const days = sp.range === "30" ? 30 : 7;
  const today = todayInDubai();
  const from = addDaysToLocalDate(today, -days);

  const [data, t] = await Promise.all([
    loadReportsPage(from, today),
    getTranslations(),
  ]);
  const ar = locale === "ar";

  const played = data.bookings.filter(
    (b) => b.status === "confirmed" || b.status === "no_show",
  );

  // Utilisation by hour is the club's single most important number: it is what
  // tells the owner which hours to price up.
  const bookedMinutesByHour = new Map<number, number>();
  const bookedMinutesByCourt = new Map<string, number>();
  for (const b of played) {
    const day = operatingDayOf(b.start);
    const startMinute = minutesIntoDay(b.start, day);
    const mins = Math.round((b.end.getTime() - b.start.getTime()) / 60_000);
    const hour = Math.floor(startMinute / 60);
    bookedMinutesByHour.set(hour, (bookedMinutesByHour.get(hour) ?? 0) + mins);
    bookedMinutesByCourt.set(
      b.courtId,
      (bookedMinutesByCourt.get(b.courtId) ?? 0) + mins,
    );
  }

  // Capacity: every court open for that hour, across the range.
  const capacityPerHour = data.courts.length * 60 * (days + 1);

  const hours = Array.from({ length: 20 }, (_, i) => i);
  const utilisation = hours.map((h) => ({
    hour: h,
    clock: `${String((h + 6) % 24).padStart(2, "0")}:00`,
    value: Math.min(1, (bookedMinutesByHour.get(h) ?? 0) / capacityPerHour),
  }));

  const peak = [...utilisation].sort((a, b) => b.value - a.value)[0];
  const quietest = [...utilisation]
    .filter((u) => u.value > 0)
    .sort((a, b) => a.value - b.value)[0];

  const revenue = addFils(...data.payments.map((p) => p.amount));
  const bySource = new Map<string, Fils>();
  for (const b of played) {
    bySource.set(b.source, addFils(bySource.get(b.source) ?? ZERO, b.total));
  }

  const noShows = data.bookings.filter((b) => b.status === "no_show").length;
  const noShowRate = played.length === 0 ? 0 : noShows / played.length;

  const bookerIds = new Set(played.map((b) => b.customerId).filter(Boolean));
  const returning = [...bookerIds].filter(
    (id) => played.filter((b) => b.customerId === id).length > 1,
  ).length;

  return (
    <PageShell
      title={t("reports.title")}
      serial={`${from} → ${today}`}
      actions={
        <div className="flex gap-1.5">
          {[7, 30].map((n) => (
            <Link
              key={n}
              href={`/admin/finances/ledgers?range=${n}`}
              className={`min-h-9 border px-3 py-1.5 font-board text-[11px] uppercase tracking-[0.14em] ${
                days === n
                  ? "border-amber bg-court-lit/30 text-amber"
                  : "border-line/20 text-line-dim"
              }`}
            >
              {n === 7 ? t("reports.last7") : t("reports.last30")}
            </Link>
          ))}
        </div>
      }
      note={t("reports.priceUpHint")}
    >
      <div className="space-y-6">
        <Panel title={t("reports.revenue")}>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            <Reading
              label={t("reports.revenue")}
              value={formatMoney(revenue, locale)}
              sub={`${played.length} entries`}
              tone="settle"
            />
            <Reading
              label={t("reports.peakHour")}
              value={peak?.clock ?? "—"}
              sub={peak ? `${Math.round(peak.value * 100)}%` : undefined}
            />
            <Reading
              label={t("reports.quietestHour")}
              value={quietest?.clock ?? "—"}
              sub={quietest ? `${Math.round(quietest.value * 100)}%` : undefined}
              tone="void"
            />
            <Reading
              label={t("reports.noShowRate")}
              value={`${Math.round(noShowRate * 100)}%`}
              sub={`${noShows} of ${played.length}`}
              tone={noShowRate > 0.05 ? "rule" : "ink"}
            />
            <Reading
              label={t("reports.newVsReturning")}
              value={`${returning} / ${bookerIds.size}`}
              sub="returning / total"
            />
          </div>
        </Panel>

        <Panel title={t("reports.utilisation")}>
          <UtilisationBars rows={utilisation} />
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title={t("reports.utilisationByCourt")}>
            <LedgerTable heads={["", "Hours booked", "Share"]}>
              {data.courts.map((c) => {
                const mins = bookedMinutesByCourt.get(c.id) ?? 0;
                const totalMins = [...bookedMinutesByCourt.values()].reduce(
                  (a, b) => a + b,
                  0,
                );
                return (
                  <LedgerRow key={c.id}>
                    <Cell className="font-semibold">{ar ? c.nameAr : c.name}</Cell>
                    <Cell numeric>{(mins / 60).toFixed(1)}</Cell>
                    <Cell numeric>
                      {totalMins === 0
                        ? "—"
                        : `${Math.round((mins / totalMins) * 100)}%`}
                    </Cell>
                  </LedgerRow>
                );
              })}
            </LedgerTable>
          </Panel>

          <Panel title={t("reports.bySource")}>
            <LedgerTable heads={["", t("booking.total")]}>
              {[...bySource.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([source, amount]) => (
                  <LedgerRow key={source}>
                    <Cell>
                      {t(`booking.sources.${source}` as "booking.sources.web")}
                    </Cell>
                    <Cell numeric>
                      {formatMoney(amount, locale, { showCurrency: false })}
                    </Cell>
                  </LedgerRow>
                ))}
            </LedgerTable>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
