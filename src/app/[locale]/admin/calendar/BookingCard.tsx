"use client";

import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/money";
import { cn } from "@/ui/cn";
import { Serial } from "@/ui/primitives";
import { Stamp, slipTreatment, statusStamp } from "@/ui/Stamp";
import { useCountdown, useHoldProgress } from "@/ui/Ticker";
import { cardGeometry, clockOf } from "./geometry";
import type { SlipView } from "./types";

/**
 * A booking, as a card lying along its court's lane.
 *
 * Turning the board on its side is what made this card readable. Vertically it
 * was 96px tall and 120px wide for a 90-minute booking, so a name, a serial, a
 * price and a state had to fight over two short lines and most of them lost.
 * Along the lane the same booking is nearly 300px wide, and everything on it
 * can simply be printed.
 *
 * State is never hue alone, per the contract: the leading edge carries the
 * colour, the stamp carries the WORD, and the panel carries the treatment
 * (hatched when blocked, desaturated when a no-show, dashed while held).
 */
export function BookingCard({
  slip,
  locale,
  dir,
  firstMinute,
  step,
  focused,
  moving,
  dimmed,
  gestureActive,
  cardHandlers,
  handleHandlers,
  onActivate,
  onFocus,
  onKeyDown,
}: {
  slip: SlipView;
  locale: string;
  dir: "ltr" | "rtl";
  firstMinute: number;
  step: number;
  focused: boolean;
  /** In keyboard move mode: the card is a ghost of where it would land. */
  moving: boolean;
  /** Filtered out by the attention filter — dimmed, never hidden. */
  dimmed: boolean;
  gestureActive: boolean;
  cardHandlers: React.DOMAttributes<HTMLElement>;
  handleHandlers: React.DOMAttributes<HTMLElement>;
  onActivate: () => void;
  onFocus: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  const t = useTranslations("status");
  const tc = useTranslations("calendar");
  const countdown = useCountdown(slip.holdExpiresAt);
  const remaining = 1 - useHoldProgress(slip.holdIssuedAt, slip.holdExpiresAt);

  const { insetInlineStart, width } = cardGeometry(
    slip.startMinute,
    slip.durationMinutes,
    firstMinute,
    step,
  );

  const stamp = statusStamp(slip, slip.participantCount);
  const stampText =
    stamp.key === "openSeats"
      ? t("openSeats", { count: stamp.count ?? 0 })
      : t(stamp.key as "held");

  // The leading edge carries the state colour; the word carries the state.
  const edge =
    slip.status === "held"
      ? "border-s-amber"
      : slip.status === "blocked"
        ? "border-s-line/35"
        : slip.paymentStatus === "paid"
          ? "border-s-ball"
          : "border-s-clay";

  // Three tiers, decided from the booking's length rather than a pixel count,
  // so they survive `--slot-w` growing on a wider screen.
  const tier =
    slip.durationMinutes >= 90 ? "full" : slip.durationMinutes >= 60 ? "half" : "tight";

  const title = slip.blockReason ?? slip.customerName ?? "—";
  const label = `${title}, ${clockOf(slip.startMinute)}–${clockOf(
    slip.startMinute + slip.durationMinutes,
  )}, ${stampText}`;

  return (
    <article
      className={cn(
        "absolute inset-y-1 flex overflow-hidden border border-line/20 border-s-[3px] bg-board/92",
        "transition-[opacity,box-shadow] duration-100",
        edge,
        slipTreatment(slip.status),
        dimmed && "opacity-30",
        moving && "z-30 shadow-[0_12px_34px_-10px_rgba(0,0,0,0.95)]",
        // While any gesture runs, the whole card layer stops taking pointer
        // events so the band underneath can be hit-tested honestly.
        gestureActive ? "pointer-events-none" : "pointer-events-auto",
      )}
      style={{ insetInlineStart, width }}
      title={`#${slip.serial} · ${title}`}
    >
      <button
        type="button"
        dir={dir}
        onClick={onActivate}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        aria-label={label}
        className={cn(
          "flex min-w-0 flex-1 cursor-grab flex-col justify-center gap-1 px-2.5 text-start outline-none",
          focused && "ring-2 ring-inset ring-ball",
        )}
        {...cardHandlers}
      >
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate font-stadium text-[13px] uppercase leading-tight tracking-[0.01em] text-line">
            {title}
          </span>
          {tier === "full" && (
            <Serial value={slip.serial} className="ms-auto shrink-0 opacity-70" />
          )}
        </div>

        {tier !== "tight" && (
          <div className="flex min-w-0 items-center gap-2">
            <Stamp tone={stamp.tone} className="shrink-0">
              {countdown ? `${stampText} ${countdown}` : stampText}
            </Stamp>
            {tier === "full" && (
              <span className="board-digit truncate text-[12px] leading-none">
                {clockOf(slip.startMinute)}
                {slip.isSeries ? " ↻" : ""}
                {slip.total > 0
                  ? ` · ${formatMoney(slip.total, locale, { showCurrency: false })}`
                  : ""}
              </span>
            )}
          </div>
        )}

        {tier === "tight" && (
          <Stamp tone={stamp.tone} className="self-start">
            {countdown ?? stampText}
          </Stamp>
        )}
      </button>

      {/*
        The hold burning down. A bar across the head of the card that physically
        shortens — the slot is going away, and this is not a progress indicator
        for a task anyone is completing.
      */}
      {slip.status === "held" && (
        <span
          aria-hidden
          // `origin-left` and not a logical origin: the board itself is pinned
          // to LTR (see Board.tsx), so time runs left-to-right in both locales
          // and so does a hold running out.
          className="pointer-events-none absolute inset-x-0 top-0 h-[3px] origin-left bg-amber"
          style={{ transform: `scaleX(${Math.max(0, remaining)})` }}
        />
      )}

      {/*
        The length grip. Present only where there is room for a 44px target and
        a length that can legally change — a maintenance block is not resized
        from the board, it is edited on the court.
      */}
      {slip.status !== "blocked" && tier !== "tight" && (
        <span
          role="separator"
          aria-label={tc("resize")}
          className={cn(
            "absolute inset-y-0 end-0 w-3 cursor-ew-resize touch-none",
            "before:absolute before:inset-y-3 before:end-1 before:w-px before:bg-line/40",
            gestureActive ? "pointer-events-none" : "pointer-events-auto",
          )}
          {...handleHandlers}
        />
      )}
    </article>
  );
}
