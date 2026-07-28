import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireAdmin } from "@/auth/guard";
import { loadPricingPage } from "@/data/loaders";
import { formatMoney } from "@/lib/money";
import { Cell, LedgerRow, LedgerTable, PageShell } from "@/ui/PageShell";
import { Panel, Reading } from "@/ui/primitives";
import { Stamp } from "@/ui/Stamp";

export const dynamic = "force-dynamic";

/** Minutes from 06:00 rendered as a wall clock. */
function clockOf(minute: number | null, fallback: string): string {
  if (minute === null) return fallback;
  const h = Math.floor((minute + 360) / 60) % 24;
  const m = minute % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin();

  const [data, t] = await Promise.all([loadPricingPage(), getTranslations()]);
  const ar = locale === "ar";

  const weekdayNames = [0, 1, 2, 3, 4, 5, 6].map((d) =>
    t(`common.weekdaysShort.${d}` as "common.weekdaysShort.0"),
  );

  return (
    <PageShell
      title={t("pricing.title")}
      serial={`${data.rules.filter((r) => r.active).length} rules`}
      note={t("reports.priceUpHint")}
    >
      <div className="space-y-6">
        {/* A worked example, so the effect of the rate card is visible rather
            than inferred from a table of conditions. */}
        <Panel title="What a booking actually costs">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {data.sample.map((s) => (
              <Reading
                key={s.label}
                label={s.label}
                value={formatMoney(s.total, locale)}
              />
            ))}
          </div>
        </Panel>

        <Panel title={t("pricing.title")}>
          <LedgerTable
            heads={[
              t("pricing.rule"),
              t("pricing.weekdays"),
              t("pricing.hours"),
              t("pricing.courts"),
              t("pricing.tiers"),
              t("pricing.durations"),
              t("pricing.priority"),
              t("pricing.amount"),
            ]}
          >
            {[...data.rules]
              .sort((a, b) => b.priority - a.priority)
              .map((r) => (
                <LedgerRow key={r.id} className={r.active ? "" : "opacity-45"}>
                  <Cell className="font-semibold">{ar ? r.labelAr : r.label}</Cell>
                  <Cell className="font-board text-[11px]">
                    {r.weekdays.length === 0
                      ? t("pricing.allDays")
                      : r.weekdays.map((d) => weekdayNames[d]).join(" ")}
                  </Cell>
                  <Cell className="font-board text-[11px] tabular-nums">
                    {r.fromMinute === null && r.toMinute === null
                      ? t("pricing.allHours")
                      : `${clockOf(r.fromMinute, "06:00")}–${clockOf(r.toMinute, "02:00")}`}
                  </Cell>
                  <Cell className="font-board text-[11px]">
                    {r.courtIds.length === 0 && r.courtTags.length === 0
                      ? t("pricing.allCourts")
                      : [...r.courtTags, ...r.courtIds].join(", ")}
                  </Cell>
                  <Cell className="font-board text-[11px]">
                    {r.tiers.length === 0
                      ? t("pricing.allTiers")
                      : r.tiers
                          .map((x) =>
                            t(`customer.tiers.${x}` as "customer.tiers.guest"),
                          )
                          .join(", ")}
                  </Cell>
                  <Cell className="font-board text-[11px] tabular-nums">
                    {r.durations.length === 0 ? "—" : r.durations.join(" / ")}
                  </Cell>
                  <Cell numeric>{r.priority}</Cell>
                  <Cell numeric className="font-semibold">
                    {formatMoney(r.amount, locale, { showCurrency: false })}
                  </Cell>
                </LedgerRow>
              ))}
          </LedgerTable>
          <p className="mt-3 font-board text-[11px] leading-relaxed text-line-dim">
            Highest priority wins; ties break on the more specific rule. The
            rule is matched against the slot&rsquo;s start, so a 21:00 booking is
            peak-priced whether it runs 60 or 120 minutes.
          </p>
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title={t("pricing.promos")}>
            <LedgerTable
              heads={[
                t("pricing.code"),
                "",
                t("pricing.uses"),
                t("pricing.amount"),
              ]}
            >
              {data.promos.map((p) => (
                <LedgerRow key={p.id}>
                  <Cell className="font-board font-bold tracking-[0.08em]">
                    {p.code}
                  </Cell>
                  <Cell>{ar ? p.labelAr : p.label}</Cell>
                  <Cell numeric>
                    {p.uses}
                    {p.maxUses !== null ? ` / ${p.maxUses}` : ""}
                  </Cell>
                  <Cell numeric>
                    {p.kind === "percent"
                      ? `${p.value}%`
                      : formatMoney(p.value as never, locale, {
                          showCurrency: false,
                        })}
                  </Cell>
                </LedgerRow>
              ))}
            </LedgerTable>
          </Panel>

          <Panel title={t("pricing.policies")}>
            <LedgerTable
              heads={[
                "",
                t("pricing.hoursBefore"),
                t("pricing.refundPercent"),
                t("pricing.outcome"),
              ]}
            >
              {[...data.policies]
                .sort((a, b) => b.hoursBefore - a.hoursBefore)
                .map((p) => (
                  <LedgerRow key={p.id}>
                    <Cell>{ar ? p.labelAr : p.label}</Cell>
                    <Cell numeric>≥ {p.hoursBefore}h</Cell>
                    <Cell numeric>{p.refundPercent}%</Cell>
                    <Cell>
                      <Stamp
                        tone={p.outcome === "refund" ? "paid" : p.outcome === "credit" ? "part" : "void"}
                      >
                        {t(
                          `pricing.outcomes.${p.outcome}` as "pricing.outcomes.refund",
                        )}
                      </Stamp>
                    </Cell>
                  </LedgerRow>
                ))}
              <LedgerRow className="hover:bg-transparent">
                <Cell colSpan={4} className="font-board text-[11px] text-clay">
                  {t("pricing.noPolicy")}
                </Cell>
              </LedgerRow>
            </LedgerTable>
            <p className="mt-3 font-board text-[11px] leading-relaxed text-line-dim">
              Under the shortest window no tier matches, so nothing is returned.
              That is expressed by absence rather than a 0% row, which keeps the
              copy honest at the counter.
            </p>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
