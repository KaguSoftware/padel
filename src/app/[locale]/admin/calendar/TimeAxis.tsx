"use client";

import { cn } from "@/ui/cn";
import { bandSpan, hourOf, isOnHour } from "./geometry";

/**
 * The clock strip along the head of the board.
 *
 * Only the hour is printed. The board is ruled every thirty minutes because
 * half of all starts are on the :30, but printing ":30" forty times turns the
 * axis into texture — the half-hour gets a rule and a tick, and the hour gets
 * the number. The evening hours are marked, because "which of my prime slots
 * are still open" is the question the owner asks this screen.
 */
export function TimeAxis({
  rowMinutes,
  step,
  peakFrom,
  peakTo,
  railLabel,
}: {
  rowMinutes: number[];
  step: number;
  /** Minutes-from-06:00 bounding the club's prime hours. */
  peakFrom: number;
  peakTo: number;
  railLabel: string;
}) {
  const first = rowMinutes[0] ?? 0;

  return (
    <div className="time-axis flex min-w-max">
      <div className="court-rail flex h-full w-[var(--rail-w)] shrink-0 items-center px-4">
        <span className="board-label board-label-sm truncate">{railLabel}</span>
      </div>

      <div className="relative h-full" style={{ width: bandSpan(rowMinutes.length) }}>
        {rowMinutes.map((minute) => {
          const onHour = isOnHour(minute);
          const peak = minute >= peakFrom && minute < peakTo;
          return (
            <div
              key={minute}
              className={cn(
                "absolute inset-y-0 flex items-center justify-start",
                onHour ? "rule-hour" : "rule-half",
              )}
              style={{
                insetInlineStart: bandSpan((minute - first) / step),
                width: bandSpan(1),
              }}
            >
              {onHour && (
                <span
                  className={cn(
                    "ps-1.5 font-board text-[13px] leading-none tabular-nums sm:text-[14px]",
                    peak ? "text-amber" : "text-amber/55",
                  )}
                >
                  {hourOf(minute)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
