import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireConsole } from "@/auth/guard";
import { getDb } from "@/data";
import { rowsOrThrow } from "@/data/query";
import { addDaysToLocalDate, todayInDubai } from "@/lib/time";
import { Cell, LedgerRow, LedgerTable, PageShell } from "@/ui/PageShell";
import { CourtMark } from "@/ui/marks";
import { Panel } from "@/ui/primitives";
import { Stamp } from "@/ui/Stamp";

export const dynamic = "force-dynamic";

function clockOf(minute: number): string {
  const h = Math.floor((minute + 360) / 60) % 24;
  const m = minute % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default async function CourtsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireConsole();

  const db = getDb();
  const today = todayInDubai();

  // One wave.
  const [courts, templates, exceptions, t] = await Promise.all([
    rowsOrThrow("courts.list", db.courts.list()),
    rowsOrThrow("courts.templates", db.availability.templates()),
    rowsOrThrow(
      "courts.exceptions",
      db.availability.exceptionsForRange(
        addDaysToLocalDate(today, -30),
        addDaysToLocalDate(today, 400),
      ),
    ),
    getTranslations(),
  ]);

  const ar = locale === "ar";
  const weekdays = [0, 1, 2, 3, 4, 5, 6];

  return (
    <PageShell title={t("courts.title")} serial={`${courts.length} courts`}>
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {courts.map((c) => (
            <article key={c.id} className="slip bg-transparent p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="painted text-[21px] leading-none">
                  {ar ? c.nameAr : c.name}
                </h2>
                <CourtMark size={28} className="text-line-dim" />
              </div>
              <dl className="mt-3 space-y-1 font-board text-[11px] uppercase tracking-[0.08em] text-line-dim">
                <div className="flex justify-between gap-2">
                  <dt>{t("courts.surface")}</dt>
                  <dd className="text-line">
                    {t(`courts.surfaces.${c.surface}` as "courts.surfaces.glass")}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>{t("courts.enclosure")}</dt>
                  <dd className="text-line">
                    {t(
                      `courts.enclosures.${c.enclosure}` as "courts.enclosures.indoor",
                    )}
                  </dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-1">
                {c.tags.map((tag) => (
                  <span
                    key={tag}
                    className="border border-line/15 px-1.5 py-0.5 font-board text-[10px] uppercase tracking-[0.1em] text-line-dim"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              {!c.active && (
                <div className="mt-3">
                  <Stamp tone="blocked">{t("status.blocked")}</Stamp>
                </div>
              )}
            </article>
          ))}
        </div>

        <Panel title={t("courts.exceptions")}>
          <LedgerTable
            heads={[
              "",
              ...weekdays.map((d) =>
                t(`common.weekdaysShort.${d}` as "common.weekdaysShort.0"),
              ),
            ]}
          >
            {courts.map((c) => (
              <LedgerRow key={c.id}>
                <Cell className="font-semibold">{ar ? c.nameAr : c.name}</Cell>
                {weekdays.map((d) => {
                  const tpl =
                    templates.find((x) => x.courtId === c.id && x.weekday === d) ??
                    templates.find((x) => x.courtId === null && x.weekday === d);
                  return (
                    <Cell key={d} className="font-board text-[11px] tabular-nums">
                      {tpl
                        ? `${clockOf(tpl.openMinute)}â€“${clockOf(tpl.closeMinute)}`
                        : t("calendar.closed")}
                    </Cell>
                  );
                })}
              </LedgerRow>
            ))}
          </LedgerTable>

          <h3 className="mt-6 border-b border-line/20 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-line-dim">
            {t("courts.ramadan")} &amp; holidays
          </h3>
          <LedgerTable heads={["", "", "", ""]} className="mt-2">
            {exceptions.map((e) => (
              <LedgerRow key={e.id}>
                <Cell className="font-board tabular-nums">
                  {e.from} â†’ {e.to}
                </Cell>
                <Cell>
                  <Stamp tone={e.openMinute === null ? "blocked" : "part"}>
                    {e.kind}
                  </Stamp>
                </Cell>
                <Cell className="font-board text-[11px] tabular-nums">
                  {e.openMinute === null || e.closeMinute === null
                    ? t("calendar.closed")
                    : `${clockOf(e.openMinute)}â€“${clockOf(e.closeMinute)}`}
                </Cell>
                <Cell>{ar ? e.noteAr : e.note}</Cell>
              </LedgerRow>
            ))}
          </LedgerTable>
          <p className="mt-3 font-board text-[11px] leading-relaxed text-line-dim">
            Ramadan hours are exception rows over a date range, not a branch in
            code â€” the dates move about eleven days earlier each Gregorian year
            and the club edits them here.
          </p>
        </Panel>
      </div>
    </PageShell>
  );
}
