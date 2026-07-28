import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireAdmin } from "@/auth/guard";
import { loadTournamentsPage } from "@/data/loaders";
import { addFils, formatMoney, ZERO } from "@/lib/money";
import { Cell, LedgerRow, LedgerTable, PageShell } from "@/ui/PageShell";
import { BracketMark } from "@/ui/marks";
import { EmptyLine, Panel, Reading } from "@/ui/primitives";
import { Stamp } from "@/ui/Stamp";

export const dynamic = "force-dynamic";

function clockOf(minute: number): string {
  const h = Math.floor((minute + 360) / 60) % 24;
  return `${String(h).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

export default async function TournamentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin();

  const [data, t] = await Promise.all([loadTournamentsPage(), getTranslations()]);
  const ar = locale === "ar";
  const customerById = new Map(data.customers.map((c) => [c.id, c]));

  return (
    <PageShell
      title={t("tournaments.title")}
      serial={`${data.tournaments.length}`}
    >
      <div className="space-y-6">
        {data.tournaments.length === 0 && (
          <EmptyLine>{t("common.empty")}</EmptyLine>
        )}

        {data.tournaments.map((tn) => {
          const entries = data.entries.filter((e) => e.tournamentId === tn.id);
          const collected = addFils(...entries.map((e) => e.paid));
          const owed = addFils(
            ...entries.filter((e) => e.paid === 0).map(() => tn.entryFee),
          );

          return (
            <Panel
              key={tn.id}
              title={
                <span className="flex items-center gap-2">
                  <BracketMark size={20} className="text-line-dim" />
                  {ar ? tn.nameAr : tn.name}
                </span>
              }
              serial={
                <Stamp tone={tn.status === "open" ? "paid" : "part"}>
                  {t(`tournaments.statuses.${tn.status}` as "tournaments.statuses.open")}
                </Stamp>
              }
            >
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
                <Reading
                  label={t("tournaments.format")}
                  value={t(
                    `tournaments.formats.${tn.format}` as "tournaments.formats.americano",
                  )}
                />
                <Reading
                  label={t("booking.when")}
                  value={`${clockOf(tn.startMinute)}–${clockOf(tn.endMinute)}`}
                  sub={tn.day}
                />
                <Reading
                  label={t("tournaments.entries")}
                  value={`${entries.length}/${tn.capacity}`}
                  sub={`${tn.courtIds.length} courts blocked`}
                />
                <Reading
                  label={t("tournaments.entryFee")}
                  value={formatMoney(tn.entryFee, locale, { showCurrency: false })}
                  sub={
                    tn.levelMin !== null
                      ? `${t("booking.level")} ${tn.levelMin}–${tn.levelMax}`
                      : undefined
                  }
                />
                <Reading
                  label={t("calendar.takings")}
                  value={formatMoney(collected, locale, { showCurrency: false })}
                  sub={
                    owed > ZERO
                      ? `${formatMoney(owed, locale, { showCurrency: false })} ${t("status.due")}`
                      : undefined
                  }
                  tone={owed > ZERO ? "rule" : "settle"}
                />
              </div>

              {entries.length > 0 && (
                <LedgerTable
                  className="mt-5"
                  heads={["#", "", t("tournaments.entryFee"), ""]}
                >
                  {entries.map((e, i) => {
                    const c = customerById.get(e.customerId);
                    return (
                      <LedgerRow key={e.id}>
                        <Cell numeric className="w-10 text-line-dim">
                          {i + 1}
                        </Cell>
                        <Cell>
                          {c ? (ar ? (c.nameAr ?? c.name) : c.name) : "—"}
                          {c?.level !== null && c?.level !== undefined && (
                            <span className="ms-2 font-board text-[11px] text-line-dim">
                              {c.level}
                            </span>
                          )}
                        </Cell>
                        <Cell numeric>
                          {formatMoney(e.paid, locale, { showCurrency: false })}
                        </Cell>
                        <Cell>
                          {e.paid > 0 ? (
                            <Stamp tone="paid">{t("status.paid")}</Stamp>
                          ) : (
                            <Stamp tone="due">{t("status.due")}</Stamp>
                          )}
                        </Cell>
                      </LedgerRow>
                    );
                  })}
                </LedgerTable>
              )}
            </Panel>
          );
        })}
      </div>
    </PageShell>
  );
}
