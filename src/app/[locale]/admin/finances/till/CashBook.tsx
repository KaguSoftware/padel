"use client";

import { useState, useTransition } from "react";
import { closeTill, openTill } from "@/app/actions/money";
import { dirhams, formatMoney, type Fils } from "@/lib/money";
import { cn } from "@/ui/cn";
import { Cell, LedgerRow, LedgerTable, PageShell } from "@/ui/PageShell";
import {
  EmptyLine,
  FieldLabel,
  InkButton,
  Panel,
  Reading,
  RuledInput,
} from "@/ui/primitives";
import { Stamp } from "@/ui/Stamp";

/**
 * The cash book.
 *
 * For a cash-heavy venue this is the module that pays for the whole system,
 * because it is the one that catches theft. The number that matters is the
 * variance, so the variance is the largest thing on the page and it is never
 * softened — a shortfall reads as a shortfall.
 */

interface Session {
  id: string;
  openingFloat: Fils;
  openedBy: string;
  openedAt: string;
}

interface HistoryRow {
  id: string;
  day: string;
  openingFloat: Fils;
  countedCash: Fils | null;
  variance: Fils | null;
  closedBy: string;
  note: string;
}

export function CashBook({
  locale,
  day,
  session,
  byMethod,
  expected,
  history,
  canClose,
  strings,
}: {
  locale: string;
  day: string;
  session: Session | null;
  byMethod: Record<string, Fils>;
  expected: Fils;
  history: HistoryRow[];
  canClose: boolean;
  strings: Record<string, string>;
}) {
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [float, setFloat] = useState("500");
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");

  // Computed live so the person counting sees the variance before committing,
  // not after. A close that surprises you is a close you argue with.
  const countedFils = counted === "" ? null : dirhams(Number(counted) || 0);
  const preview =
    countedFils === null ? null : ((countedFils - expected) as Fils);

  return (
    <PageShell
      title={strings.title}
      serial={day}
      note={notice}
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-8">
          <Panel title={strings.cashTaken}>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              <Reading
                label={strings.openingFloat}
                value={formatMoney(session?.openingFloat ?? (0 as Fils), locale, {
                  showCurrency: false,
                })}
              />
              <Reading
                label={strings.cashTaken}
                value={formatMoney(byMethod.cash, locale, { showCurrency: false })}
              />
              <Reading
                label={strings.cardTaken}
                value={formatMoney(byMethod.card, locale, { showCurrency: false })}
              />
              <Reading
                label={strings.walletTaken}
                value={formatMoney(byMethod.wallet, locale, { showCurrency: false })}
              />
            </div>

            <div className="mt-5 border-t-2 border-line/25 pt-4">
              <Reading
                label={strings.expected}
                value={formatMoney(expected, locale)}
                sub={
                  session
                    ? `${strings.openedBy} ${session.openedBy}`
                    : strings.noSession
                }
              />
            </div>
          </Panel>

          <Panel title={strings.closedShifts}>
            {history.length === 0 ? (
              <EmptyLine>{strings.empty}</EmptyLine>
            ) : (
              <LedgerTable
                heads={[
                  "",
                  strings.openingFloat,
                  strings.counted,
                  strings.variance,
                  strings.closedBy,
                  "",
                ]}
              >
                {history.map((h) => (
                  <LedgerRow key={h.id}>
                    <Cell className="font-board tabular-nums">{h.day}</Cell>
                    <Cell numeric>
                      {formatMoney(h.openingFloat, locale, { showCurrency: false })}
                    </Cell>
                    <Cell numeric>
                      {h.countedCash === null
                        ? "—"
                        : formatMoney(h.countedCash, locale, { showCurrency: false })}
                    </Cell>
                    <Cell numeric>
                      <VarianceFigure
                        variance={h.variance}
                        locale={locale}
                        strings={strings}
                      />
                    </Cell>
                    <Cell>{h.closedBy}</Cell>
                    <Cell className="max-w-64 truncate text-[14px] text-line-dim">
                      {h.note}
                    </Cell>
                  </LedgerRow>
                ))}
              </LedgerTable>
            )}
          </Panel>
        </div>

        <aside className="space-y-4">
          {session === null ? (
            <Panel title={strings.open}>
              <FieldLabel htmlFor="float">{strings.openingFloat}</FieldLabel>
              <RuledInput
                id="float"
                inputMode="decimal"
                value={float}
                onChange={(e) => setFloat(e.target.value)}
              />
              <InkButton
                variant="primary"
                className="mt-4 w-full"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await openTill(dirhams(Number(float) || 0));
                    setNotice(res.ok ? "Shift opened." : res.message);
                  })
                }
              >
                {strings.open}
              </InkButton>
            </Panel>
          ) : (
            <Panel title={strings.close}>
              <p className="mb-3 text-[14px] text-line-dim">
                {strings.countPrompt}
              </p>

              <FieldLabel htmlFor="counted">{strings.counted}</FieldLabel>
              <RuledInput
                id="counted"
                inputMode="decimal"
                value={counted}
                onChange={(e) => setCounted(e.target.value)}
                placeholder="0.00"
              />

              {preview !== null && (
                <div className="mt-4 border-t-2 border-line/25 pt-3">
                  <Reading
                    label={strings.variance}
                    value={
                      <VarianceFigure
                        variance={preview}
                        locale={locale}
                        strings={strings}
                      />
                    }
                    tone={preview === 0 ? "settle" : "rule"}
                  />
                </div>
              )}

              <div className="mt-3">
                <FieldLabel htmlFor="note">{strings.varianceNote}</FieldLabel>
                <RuledInput
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <InkButton
                variant="primary"
                className="mt-4 w-full"
                disabled={
                  pending ||
                  !canClose ||
                  countedFils === null ||
                  (preview !== null && preview !== 0 && note.trim().length < 3)
                }
                onClick={() =>
                  start(async () => {
                    const res = await closeTill({
                      id: session.id,
                      countedFils: countedFils ?? 0,
                      note,
                    });
                    setNotice(res.ok ? "Shift closed." : res.message);
                    setCounted("");
                    setNote("");
                  })
                }
              >
                {strings.close}
              </InkButton>

              {preview !== null && preview !== 0 && note.trim().length < 3 && (
                <p className="mt-2 board-label leading-relaxed text-clay">
                  A shift that does not balance cannot be closed without an
                  explanation. This is the point of the module.
                </p>
              )}
            </Panel>
          )}
        </aside>
      </div>
    </PageShell>
  );
}

function VarianceFigure({
  variance,
  locale,
  strings,
}: {
  variance: Fils | null;
  locale: string;
  strings: Record<string, string>;
}) {
  if (variance === null) return <span className="text-line-dim">—</span>;
  if (variance === 0) {
    return <Stamp tone="paid">{strings.balanced}</Stamp>;
  }
  const short = variance < 0;
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1.5 tabular-nums",
        short ? "text-clay" : "text-amber",
      )}
    >
      {formatMoney(Math.abs(variance) as Fils, locale, { showCurrency: false })}
      <span className="board-label board-label-sm text-inherit">
        {short ? strings.short : strings.over}
      </span>
    </span>
  );
}
