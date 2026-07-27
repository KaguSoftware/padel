"use client";

import { useState, useTransition } from "react";
import { joinOpenMatch } from "@/app/actions/customers";
import { formatMoney, type Fils } from "@/lib/money";
import { cn } from "@/ui/cn";
import { BoardChip } from "@/ui/board";
import { Ball, CourtPlate } from "@/ui/court";
import { EmptyLine, InkButton, Serial } from "@/ui/primitives";

export interface MatchView {
  id: string;
  serial: number;
  courtName: string;
  day: string;
  startClock: string;
  endClock: string;
  seats: number;
  partySize: number;
  levelMin: number | null;
  levelMax: number | null;
  players: { name: string; isBooker: boolean }[];
  yourShare: Fils;
  eligible: boolean;
  alreadyIn: boolean;
}

/**
 * Every match is a board card with its empty seats drawn as empty seats — the
 * numbered places that are still blank, and the price of taking one.
 *
 * The seat count is the loudest thing on the card, in optic yellow, because it
 * is the only question a player scanning this page is actually asking.
 */
export function MatchBoard({
  locale,
  matches,
  meId,
  strings,
}: {
  locale: string;
  matches: MatchView[];
  meId: string | null;
  meLevel: number | null;
  strings: Record<string, string>;
}) {
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [joined, setJoined] = useState<Set<string>>(new Set());

  return (
    <main className="court-world court-surface min-h-dvh">
      <div className="relative mx-auto w-full max-w-6xl px-4 py-10 sm:px-5">
        <h1 className="painted border-b border-line/25 pb-4 text-[clamp(2rem,6vw,3.5rem)]">
          {strings.title}
        </h1>

        {notice && (
          <p
            role="status"
            className="mt-4 border border-clay bg-board px-3 py-2 font-board text-[12px] text-clay"
          >
            {notice}
          </p>
        )}

        {matches.length === 0 ? (
          <div className="mt-10">
            <EmptyLine>{strings.empty}</EmptyLine>
          </div>
        ) : (
          <ul className="mt-7 grid gap-4 lg:grid-cols-2">
            {matches.map((m) => {
              const isIn = m.alreadyIn || joined.has(m.id);
              const seats = isIn ? Math.max(0, m.seats - 1) : m.seats;
              const full = seats === 0;

              return (
                <li
                  key={m.id}
                  className={cn(
                    "board-panel relative overflow-hidden",
                    full && "opacity-60",
                  )}
                >
                  <CourtPlate
                    n={m.serial % 100}
                    className="pointer-events-none absolute -end-3 -top-6 text-[7rem]"
                  />

                  <div className="relative flex flex-col gap-4 p-4 sm:flex-row sm:items-stretch sm:p-5">
                    {/* What and when. */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <h2 className="truncate font-stadium text-[15px] uppercase tracking-[0.06em] text-line">
                          {m.courtName}
                        </h2>
                        <Serial value={m.serial} />
                      </div>

                      <p className="mt-1.5 board-digit text-[14px] leading-none">
                        {m.day} · {m.startClock}–{m.endClock}
                      </p>

                      {m.levelMin !== null && (
                        <p className="mt-2.5">
                          <BoardChip state="closed">
                            {strings.levelBandLabel} {m.levelMin}–{m.levelMax}
                          </BoardChip>
                        </p>
                      )}

                      {/* The four places. Taken ones carry a name; the open
                          ones are visibly, countably blank. */}
                      <ol className="mt-4 space-y-1.5 border-t border-line/15 pt-3">
                        {m.players.map((p, i) => (
                          <li
                            key={i}
                            className="flex items-center gap-2.5 text-[13px] text-line"
                          >
                            <span className="board-digit w-4 shrink-0 text-[11px]">
                              {i + 1}
                            </span>
                            <Ball size={7} />
                            <span className="truncate">{p.name}</span>
                            {p.isBooker && (
                              <span className="shrink-0 font-board text-[9px] uppercase tracking-[0.14em] text-amber">
                                {strings.booker}
                              </span>
                            )}
                          </li>
                        ))}
                        {Array.from({ length: seats }, (_, i) => (
                          <li
                            key={`open-${i}`}
                            className="flex items-center gap-2.5 text-[13px] text-line-dim"
                          >
                            <span className="board-digit w-4 shrink-0 text-[11px] opacity-50">
                              {m.players.length + i + 1}
                            </span>
                            <span className="size-[7px] shrink-0 rounded-full border border-dashed border-line/40" />
                            <span className="h-px flex-1 border-b border-dashed border-line/25" />
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* The ask: how many seats, at what price, and the action. */}
                    <div className="flex shrink-0 items-end justify-between gap-4 border-t border-line/15 pt-4 sm:w-32 sm:flex-col sm:items-stretch sm:border-s sm:border-t-0 sm:ps-5 sm:pt-0">
                      <div className="sm:text-center">
                        <span
                          className={cn(
                            "painted block text-[40px] leading-none tabular-nums",
                            full ? "text-line-dim" : "live",
                          )}
                        >
                          {seats}
                        </span>
                        <span className="mt-1 block font-board text-[9px] uppercase leading-tight tracking-[0.14em] text-line-dim">
                          {strings.seatsLabel}
                        </span>
                      </div>

                      <div className="text-end sm:text-center">
                        <span className="block font-board text-[9px] uppercase tracking-[0.14em] text-line-dim">
                          {strings.shareLabel}
                        </span>
                        <span className="board-digit block text-[16px] leading-tight">
                          {formatMoney(m.yourShare, locale, {
                            showCurrency: false,
                          })}
                        </span>
                      </div>

                      <div className="sm:mt-auto">
                        {isIn ? (
                          <BoardChip state="open">{strings.alreadyIn}</BoardChip>
                        ) : !m.eligible ? (
                          <BoardChip state="closed" className="sm:w-full sm:justify-center">
                            <span title={strings.outOfBand}>
                              {strings.levelBandLabel}
                            </span>
                          </BoardChip>
                        ) : (
                          <InkButton
                            size="sm"
                            variant="primary"
                            className="sm:w-full"
                            disabled={pending || full}
                            onClick={() => {
                              if (!meId) {
                                setNotice(strings.signIn);
                                return;
                              }
                              start(async () => {
                                const res = await joinOpenMatch(m.id, meId);
                                if (res.ok) {
                                  setJoined((s) => new Set(s).add(m.id));
                                  setNotice(null);
                                } else {
                                  setNotice(res.message);
                                }
                              });
                            }}
                          >
                            {strings.join}
                          </InkButton>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
