import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireConsole } from "@/auth/guard";
import { loadAcademyPage } from "@/data/loaders";
import { addFils, formatMoney, mulFils, type Fils, ZERO } from "@/lib/money";
import { clock } from "@/lib/time";
import { Cell, LedgerRow, LedgerTable, PageShell } from "@/ui/PageShell";
import { EmptyLine, Panel, Reading } from "@/ui/primitives";
import { Stamp } from "@/ui/Stamp";

export const dynamic = "force-dynamic";

export default async function AcademyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireConsole();

  const [data, t] = await Promise.all([loadAcademyPage(), getTranslations()]);
  const ar = locale === "ar";

  const bookingById = new Map(data.bookings.map((b) => [b.id, b]));
  const customerById = new Map(data.customers.map((c) => [c.id, c]));

  const enrolmentsByClass = new Map<string, typeof data.enrolments>();
  for (const e of data.enrolments) {
    enrolmentsByClass.set(e.classId, [
      ...(enrolmentsByClass.get(e.classId) ?? []),
      e,
    ]);
  }

  // Coach commission: a read-time computation over the roster, never a stored
  // figure. A stored commission goes stale the moment a rate changes.
  const commissionByCoach = new Map<string, Fils>();
  for (const cls of data.classes) {
    const coach = data.coaches.find((c) => c.id === cls.coachId);
    if (!coach) continue;
    const paid = addFils(
      ...(enrolmentsByClass.get(cls.id) ?? []).map((e) => e.paid),
    );
    commissionByCoach.set(
      coach.id,
      addFils(
        commissionByCoach.get(coach.id) ?? ZERO,
        mulFils(paid, coach.commissionPercent / 100),
      ),
    );
  }

  return (
    <PageShell
      title={t("coaching.title")}
      serial={`${data.classes.length} sessions`}
    >
      <div className="space-y-6">
        <Panel title={t("coaching.coaches")}>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.coaches.map((c) => (
              <Reading
                key={c.id}
                label={`${ar ? c.nameAr : c.name} · ${c.commissionPercent}%`}
                value={formatMoney(commissionByCoach.get(c.id) ?? ZERO, locale)}
                sub={t("coaching.commission")}
                tone="settle"
              />
            ))}
          </div>
        </Panel>

        <Panel title={t("coaching.classes")}>
          {data.classes.length === 0 ? (
            <EmptyLine>{t("common.empty")}</EmptyLine>
          ) : (
            <LedgerTable
              heads={[
                "",
                t("coaching.coaches"),
                t("booking.when"),
                t("coaching.pricePerHead"),
                t("coaching.roster"),
                t("booking.level"),
                "",
              ]}
            >
              {data.classes.map((cls) => {
                const booking = bookingById.get(cls.bookingId);
                const roster = enrolmentsByClass.get(cls.id) ?? [];
                const coach = data.coaches.find((c) => c.id === cls.coachId);
                const unpaid = roster.filter((e) => e.paid === 0).length;
                return (
                  <LedgerRow key={cls.id}>
                    <Cell className="font-semibold">
                      {ar ? cls.titleAr : cls.title}
                    </Cell>
                    <Cell>{coach ? (ar ? coach.nameAr : coach.name) : "—"}</Cell>
                    <Cell className="font-board text-[11px] tabular-nums">
                      {booking
                        ? `${booking.operatingDay} ${clock(booking.start)}`
                        : "—"}
                    </Cell>
                    <Cell numeric>
                      {formatMoney(cls.pricePerHead, locale, {
                        showCurrency: false,
                      })}
                    </Cell>
                    <Cell numeric>
                      {roster.length}/{cls.capacity}
                    </Cell>
                    <Cell className="font-board text-[11px] tabular-nums">
                      {cls.levelMin}–{cls.levelMax}
                    </Cell>
                    <Cell>
                      <span className="flex gap-1.5">
                        {roster.length >= cls.capacity && (
                          <Stamp tone="blocked">{t("coaching.full")}</Stamp>
                        )}
                        {unpaid > 0 && (
                          <Stamp tone="due">
                            {unpaid} {t("status.due")}
                          </Stamp>
                        )}
                      </span>
                    </Cell>
                  </LedgerRow>
                );
              })}
            </LedgerTable>
          )}
        </Panel>

        <Panel title={t("coaching.roster")}>
          <div className="grid gap-6 md:grid-cols-2">
            {data.classes.map((cls) => (
              <div key={cls.id}>
                <h3 className="border-b border-line/20 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-line-dim">
                  {ar ? cls.titleAr : cls.title}
                </h3>
                <ul className="mt-2 space-y-1">
                  {(enrolmentsByClass.get(cls.id) ?? []).map((e) => {
                    const c = customerById.get(e.customerId);
                    return (
                      <li
                        key={e.id}
                        className="flex items-center justify-between gap-3 border-b border-line/15 py-1.5 text-[13px]"
                      >
                        <span>{c ? (ar ? (c.nameAr ?? c.name) : c.name) : "—"}</span>
                        {e.paid > 0 ? (
                          <Stamp tone="paid">{t("status.paid")}</Stamp>
                        ) : (
                          <Stamp tone="due">{t("status.due")}</Stamp>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </PageShell>
  );
}
