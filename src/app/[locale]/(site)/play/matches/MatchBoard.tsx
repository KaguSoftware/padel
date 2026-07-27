"use client";

import { useState, useTransition } from "react";
import { joinOpenMatch } from "@/app/actions/customers";
import { formatMoney, type Fils } from "@/lib/money";
import { cn } from "@/ui/cn";
import { CourtMark, TearMark } from "@/ui/marks";
import { EmptyLine, InkButton, Serial } from "@/ui/primitives";
import { Stamp } from "@/ui/Stamp";

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
 * Each match is a slip with a detachable stub — the open seats are literally
 * the part that tears off. That is the world's own device for "this piece is
 * available to someone else", and it is doing work here rather than decorating.
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
    <main className="ledger-paper min-h-dvh">
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <h1 className="border-b-2 border-rule pb-3 font-display text-[clamp(2rem,5vw,3rem)] leading-none text-ink">
          {strings.title}
        </h1>

        {notice && (
          <p
            role="status"
            className="mt-4 border border-rule bg-paper px-3 py-2 font-mono text-[12px] text-rule"
          >
            {notice}
          </p>
        )}

        {matches.length === 0 ? (
          <div className="mt-10">
            <EmptyLine>{strings.empty}</EmptyLine>
          </div>
        ) : (
          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {matches.map((m) => {
              const isIn = m.alreadyIn || joined.has(m.id);
              const seats = isIn ? Math.max(0, m.seats - 1) : m.seats;

              return (
                <li key={m.id} className="slip flex bg-paper">
                  {/* The record half. */}
                  <div className="min-w-0 flex-1 p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <CourtMark size={18} className="text-ink-faint" />
                        <h2 className="font-display text-[21px] leading-none">
                          {m.courtName}
                        </h2>
                      </span>
                      <Serial value={m.serial} />
                    </div>

                    <p className="mt-1.5 font-mono text-[12px] tabular-nums text-ink-soft">
                      {m.day} · {m.startClock}–{m.endClock}
                    </p>

                    {m.levelMin !== null && (
                      <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.1em] text-brass">
                        {strings.levelBandLabel} {m.levelMin}–{m.levelMax}
                      </p>
                    )}

                    <ul className="mt-3 space-y-1 border-t border-paper-edge pt-2">
                      {m.players.map((p, i) => (
                        <li
                          key={i}
                          className="flex items-baseline gap-2 text-[13px]"
                        >
                          <span className="font-mono text-[10px] text-ink-faint">
                            {i + 1}
                          </span>
                          <span>{p.name}</span>
                          {p.isBooker && (
                            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-brass">
                              {strings.booker}
                            </span>
                          )}
                        </li>
                      ))}
                      {Array.from({ length: seats }, (_, i) => (
                        <li
                          key={`open-${i}`}
                          className="flex items-baseline gap-2 text-[13px] text-ink-faint"
                        >
                          <span className="font-mono text-[10px]">
                            {m.players.length + i + 1}
                          </span>
                          <span className="border-b border-dashed border-ink-faint px-8">
                            &nbsp;
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* The stub — what tears off when someone takes a seat. */}
                  <div
                    className={cn(
                      "flex w-32 shrink-0 flex-col items-center justify-between gap-2 border-s border-dashed border-ink-faint p-3 text-center",
                      seats === 0 && "opacity-50",
                    )}
                  >
                    <TearMark size={14} className="text-ink-faint" />

                    <div>
                      <span className="block font-display text-[32px] leading-none tabular-nums text-brass">
                        {seats}
                      </span>
                      <span className="block font-mono text-[9px] uppercase leading-tight tracking-[0.1em] text-ink-soft">
                        {strings.seatsLabel}
                      </span>
                    </div>

                    <div>
                      <span className="block font-mono text-[9px] uppercase tracking-[0.1em] text-ink-soft">
                        {strings.shareLabel}
                      </span>
                      <span className="block font-mono text-[13px] tabular-nums text-ink">
                        {formatMoney(m.yourShare, locale, { showCurrency: false })}
                      </span>
                    </div>

                    {isIn ? (
                      <Stamp tone="paid">{strings.alreadyIn}</Stamp>
                    ) : !m.eligible ? (
                      <Stamp tone="void" title={strings.outOfBand}>
                        —
                      </Stamp>
                    ) : (
                      <InkButton
                        size="sm"
                        variant="primary"
                        className="w-full"
                        disabled={pending || seats === 0}
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
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
