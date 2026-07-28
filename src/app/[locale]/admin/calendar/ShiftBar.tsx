"use client";

import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/money";
import type { Fils } from "@/lib/money";
import { cn } from "@/ui/cn";

/**
 * The shift's running figures.
 *
 * Deliberately quiet, and deliberately small. These are the owner's numbers on
 * a screen that belongs to the front desk — worth having in view, not worth a
 * row of 30px painted readouts competing with the board for the first thing
 * your eye lands on. The board is the product; this is the margin note.
 *
 * Outstanding is the exception: it is the only figure here that is a job rather
 * than a fact, so it turns clay when there is one.
 */
export function ShiftBar({
  locale,
  takings,
  dueCount,
  utilisation,
}: {
  locale: string;
  takings: { cash: Fils; card: Fils; wallet: Fils; total: Fils };
  dueCount: number;
  utilisation: number;
}) {
  const t = useTranslations("calendar");

  return (
    <div className="scroll-x flex items-center gap-x-7 gap-y-1 whitespace-nowrap">
      <Figure label={t("takings")} value={formatMoney(takings.total, locale)} strong />
      <Figure label={t("cash")} value={formatMoney(takings.cash, locale)} />
      <Figure label={t("card")} value={formatMoney(takings.card, locale)} />
      <Figure
        label={t("utilisation")}
        value={`${Math.round(utilisation * 100)}%`}
      />
      <Figure
        label={t("outstanding")}
        value={String(dueCount)}
        tone={dueCount > 0 ? "due" : "ok"}
      />
    </div>
  );
}

function Figure({
  label,
  value,
  tone = "ok",
  strong = false,
}: {
  label: string;
  value: string;
  tone?: "ok" | "due";
  strong?: boolean;
}) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="board-label board-label-sm">{label}</span>
      <span
        className={cn(
          "font-board tabular-nums",
          strong ? "text-[16px]" : "text-[14px]",
          tone === "due" ? "text-clay" : "text-line",
        )}
      >
        {value}
      </span>
    </span>
  );
}
