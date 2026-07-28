"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { cn } from "@/ui/cn";
import type { DayMark } from "./types";

/**
 * The week, as a strip.
 *
 * It replaces a `‹ Today ›` pair. Those three controls could only answer "what
 * about tomorrow" one press at a time, and answered "which evening this week
 * still has room" not at all — staff were stepping through days to find out.
 *
 * Each day carries how full it was as a bar under its number, so the answer is
 * visible before anything is clicked. The bar is a figure as well as a shape:
 * the utilisation is on the tooltip and in the accessible name, because a bar
 * chart of seven bars three pixels apart is not a reading anyone can take.
 */
export function DayStrip({
  days,
  current,
}: {
  days: DayMark[];
  current: string;
}) {
  const t = useTranslations("calendar");

  return (
    <nav aria-label={t("week")} className="scroll-x flex gap-1.5">
      {days.map((d) => {
        const active = d.day === current;
        const pct = Math.round(d.utilisation * 100);

        return (
          <Link
            key={d.day}
            href={`/admin/calendar?d=${d.day}`}
            aria-current={active ? "page" : undefined}
            title={`${d.weekday} ${d.dayOfMonth} — ${t("utilisationPct", { pct })}`}
            className={cn(
              "group flex min-h-14 w-14 shrink-0 flex-col items-center justify-center gap-1 border px-1 transition-colors duration-100",
              active
                ? "border-line bg-line/12 text-line"
                : "border-line/20 text-line-dim hover:border-line/45 hover:text-line",
            )}
          >
            <span className="board-label board-label-sm leading-none text-inherit">
              {d.weekday}
            </span>
            <span
              className={cn(
                "font-board text-[15px] leading-none tabular-nums",
                d.isToday ? "text-ball" : active ? "text-line" : "text-amber/80",
              )}
            >
              {d.dayOfMonth}
            </span>
            {/* How full the day was. Track and fill, both 3px — a sparkline
                pretending to be data is exactly what this must not be. */}
            <span className="block h-[3px] w-7 bg-line/15" aria-hidden>
              <span
                className={cn("block h-full", active ? "bg-line" : "bg-line/45")}
                style={{ width: `${pct}%` }}
              />
            </span>
            <span className="sr-only">{t("utilisationPct", { pct })}</span>
          </Link>
        );
      })}
    </nav>
  );
}
