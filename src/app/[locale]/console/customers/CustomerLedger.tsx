"use client";

import { useMemo, useState } from "react";
import type { MembershipTier } from "@/data/types";
import type { Fils } from "@/lib/money";
import { formatMoney } from "@/lib/money";
import { foldedIncludes, formatPhone, withinBound } from "@/lib/text";
import { cn } from "@/ui/cn";
import { Cell, LedgerRow, LedgerTable, PageShell } from "@/ui/PageShell";
import { EmptyLine, RuledInput, RuledSelect } from "@/ui/primitives";
import { Stamp } from "@/ui/Stamp";

/**
 * Filtering is 100% client-side over rows already in memory.
 *
 * There is no debounce, because the only thing a debounce ever rate-limited was
 * a network request that no longer happens; keeping one would be 250ms of pure
 * added latency per keystroke. The URL is deliberately not touched either â€” a
 * `router.push` per keystroke is a round-trip plus a history entry each time.
 */

export interface CustomerRow {
  id: string;
  name: string;
  altName: string;
  phone: string;
  level: number | null;
  tier: MembershipTier;
  creditBalance: Fils;
  noShowCount: number;
  totalSpend: Fils;
  blocked: boolean;
  blockedReason: string | null;
  bookings: number;
  duplicate: boolean;
}

interface Strings {
  title: string;
  search: string;
  phone: string;
  name: string;
  level: string;
  tier: string;
  credit: string;
  noShows: string;
  spend: string;
  blocked: string;
  unrated: string;
  mergeSuggestion: string;
  empty: string;
  all: string;
  tiers: Record<MembershipTier, string>;
}

export function CustomerLedger({
  locale,
  rows,
  strings,
}: {
  locale: string;
  rows: CustomerRow[];
  strings: Strings;
}) {
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<MembershipTier | "">("");
  const [minLevel, setMinLevel] = useState("");
  const [onlyIssues, setOnlyIssues] = useState(false);

  // Options are built from the FULL list, never the visible rows â€” otherwise
  // they collapse as you narrow and you can never widen again.
  const tiers = useMemo(
    () => [...new Set(rows.map((r) => r.tier))].sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const min = minLevel === "" ? null : Number(minLevel);
    return rows.filter((r) => {
      if (tier && r.tier !== tier) return false;
      // withinBound, not `r.level >= min` â€” Number(null) is 0, and an unrated
      // player would pass every minimum-level filter as though they were a 0.
      if (min !== null && !withinBound(r.level, min, null)) return false;
      if (onlyIssues && !r.blocked && !r.duplicate && r.noShowCount === 0) {
        return false;
      }
      if (query.trim()) {
        const digits = query.replace(/\D/g, "");
        const hit =
          foldedIncludes(r.name, query) ||
          foldedIncludes(r.altName, query) ||
          (digits.length >= 3 && r.phone.includes(digits));
        if (!hit) return false;
      }
      return true;
    });
  }, [rows, query, tier, minLevel, onlyIssues]);

  return (
    <PageShell
      title={strings.title}
      serial={`${filtered.length} / ${rows.length}`}
    >
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <RuledInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={strings.search}
            aria-label={strings.search}
            type="search"
          />
        </div>
        <div>
          <RuledSelect
            value={tier}
            onChange={(e) => setTier(e.target.value as MembershipTier | "")}
            aria-label={strings.tier}
          >
            <option value="">{strings.all}</option>
            {tiers.map((tr) => (
              <option key={tr} value={tr}>
                {strings.tiers[tr]}
              </option>
            ))}
          </RuledSelect>
        </div>
        <div>
          <RuledInput
            value={minLevel}
            onChange={(e) => setMinLevel(e.target.value)}
            placeholder={`${strings.level} â‰¥`}
            aria-label={`${strings.level} minimum`}
            inputMode="decimal"
          />
        </div>
        <label className="flex min-h-11 items-center gap-2 text-[13px] text-line-dim">
          <input
            type="checkbox"
            checked={onlyIssues}
            onChange={(e) => setOnlyIssues(e.target.checked)}
            className="size-4 accent-[var(--color-ball)]"
          />
          Needs attention
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyLine>{strings.empty}</EmptyLine>
      ) : (
        <LedgerTable
          heads={[
            strings.name,
            strings.phone,
            strings.level,
            strings.tier,
            "Bookings",
            strings.noShows,
            strings.credit,
            strings.spend,
            "",
          ]}
        >
          {filtered.map((r) => (
            <LedgerRow key={r.id}>
              <Cell>
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "font-semibold",
                      r.blocked && "text-line-dim line-through",
                    )}
                  >
                    {r.name}
                  </span>
                  {r.altName && (
                    <span className="text-[11px] text-line-dim">{r.altName}</span>
                  )}
                </span>
              </Cell>
              <Cell className="font-board tabular-nums text-line-dim">
                {formatPhone(r.phone)}
              </Cell>
              <Cell numeric>
                {r.level ?? (
                  <span className="text-line-dim">{strings.unrated}</span>
                )}
              </Cell>
              <Cell>
                <span className="font-board text-[11px] uppercase tracking-[0.1em] text-line-dim">
                  {strings.tiers[r.tier]}
                </span>
              </Cell>
              <Cell numeric>{r.bookings}</Cell>
              <Cell numeric className={r.noShowCount > 2 ? "text-clay" : ""}>
                {r.noShowCount}
              </Cell>
              <Cell numeric className={r.creditBalance > 0 ? "text-ball" : ""}>
                {formatMoney(r.creditBalance, locale, { showCurrency: false })}
              </Cell>
              <Cell numeric>
                {formatMoney(r.totalSpend, locale, { showCurrency: false })}
              </Cell>
              <Cell>
                <span className="flex gap-1.5">
                  {r.blocked && (
                    <Stamp tone="blocked" title={r.blockedReason ?? undefined}>
                      {strings.blocked}
                    </Stamp>
                  )}
                  {r.duplicate && (
                    <Stamp tone="part" title={strings.mergeSuggestion}>
                      DUP
                    </Stamp>
                  )}
                </span>
              </Cell>
            </LedgerRow>
          ))}
        </LedgerTable>
      )}
    </PageShell>
  );
}
