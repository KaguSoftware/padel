"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/ui/cn";
import { CourtPlate } from "@/ui/court";
import { bandSpan, clockOf, isClosedAt, isOnHour } from "./geometry";
import type { CourtLane } from "./types";

/**
 * One court, along the whole day.
 *
 * The lane is a strip of thirty-minute bands with the cards floating over
 * them. Bands are real elements rather than a painted background for two
 * reasons: the drag gesture hit-tests against them (which is what makes it
 * correct under RTL and horizontal scroll without arithmetic), and a keyboard
 * user needs something to land on.
 *
 * Closure is resolved per band, not per court. The board used to ask "does
 * this court have any open cell today?" and hatch all of it or none of it, so
 * a shortened Ramadan window or a two-hour maintenance block drew as fully
 * open on a board whose server rejects every write into it.
 */
export function Lane({
  lane,
  index,
  rowMinutes,
  step,
  firstMinute,
  occupied,
  cursor,
  dir,
  bandHandlers,
  onCursor,
  onBandKeyDown,
  children,
}: {
  lane: CourtLane;
  index: number;
  rowMinutes: number[];
  step: number;
  firstMinute: number;
  occupied: ReadonlySet<string>;
  /** The one band holding the roving tabindex, or null when it is elsewhere. */
  cursor: number | null;
  dir: "ltr" | "rtl";
  bandHandlers: (band: {
    courtId: string;
    minute: number;
    free: boolean;
  }) => React.DOMAttributes<HTMLElement>;
  onCursor: (courtId: string, minute: number) => void;
  onBandKeyDown: (e: React.KeyboardEvent, courtId: string, minute: number) => void;
  children: React.ReactNode;
}) {
  const t = useTranslations("calendar");

  return (
    <div className="lane flex" role="row">
      <div
        className="court-rail flex w-[var(--rail-w)] shrink-0 items-center gap-3 px-4"
        dir={dir}
      >
        <CourtPlate n={index + 1} className="shrink-0 text-[26px] leading-none" />
        <span className="min-w-0">
          <span className="block truncate font-stadium text-[13px] uppercase leading-tight tracking-[0.02em] text-line">
            {lane.name}
          </span>
          <span
            className={cn(
              "board-label board-label-sm block truncate",
              lane.closedNote && "text-clay",
            )}
          >
            {lane.closedNote ?? lane.enclosure}
          </span>
        </span>
      </div>

      <div className="relative h-full" style={{ width: bandSpan(rowMinutes.length) }}>
        {rowMinutes.map((minute) => {
          const taken = occupied.has(`${lane.id}:${minute}`);
          const closed = lane.shut || isClosedAt(lane.closedRuns, minute);
          const free = !taken && !closed;
          const onHour = isOnHour(minute);

          return (
            <button
              key={minute}
              type="button"
              role="gridcell"
              data-band-court={lane.id}
              data-band-minute={minute}
              tabIndex={cursor === minute ? 0 : -1}
              disabled={!free}
              aria-disabled={!free || undefined}
              aria-label={`${lane.name} ${clockOf(minute)}${
                closed ? ` — ${t("closed")}` : ""
              }`}
              onFocus={() => onCursor(lane.id, minute)}
              onKeyDown={(e) => onBandKeyDown(e, lane.id, minute)}
              className={cn(
                "absolute inset-y-0 touch-none outline-none",
                onHour ? "rule-hour" : "rule-half",
                free && "band-free",
                closed && "hatched band-closed",
                !free && !closed && "bg-transparent",
                "focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ball",
              )}
              style={{
                insetInlineStart: bandSpan((minute - firstMinute) / step),
                width: bandSpan(1),
              }}
              {...bandHandlers({ courtId: lane.id, minute, free })}
            />
          );
        })}

        {/* The cards ride over the ruling. The layer itself never takes pointer
            events — each card opts in — so a gesture crossing the gap between
            two bookings hit-tests the band, not the empty layer above it. */}
        <div className="pointer-events-none absolute inset-0">{children}</div>
      </div>
    </div>
  );
}
