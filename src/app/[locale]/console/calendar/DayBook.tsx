"use client";

import { useCallback, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { moveBooking } from "@/app/actions/bookings";
import type {
  BookingSource,
  BookingStatus,
  MembershipTier,
  PaymentStatus,
} from "@/data/types";
import type { Fils } from "@/lib/money";
import { formatMoney } from "@/lib/money";
import { Link } from "@/i18n/routing";
import { cn } from "@/ui/cn";
import { ColumnHead, InkButton, Reading, Serial } from "@/ui/primitives";
import { Stamp, slipTreatment, statusStamp } from "@/ui/Stamp";
import { useCountdown, useHoldProgress } from "@/ui/Ticker";
import { EntryLine, type EntryDraft } from "./EntryLine";

/**
 * THE DAY BOOK.
 *
 * A ruled page: courts are ruled columns, hours are banded rows, bookings are
 * card slips set into the ruling. Staff spend most of their day here, standing,
 * on a tablet, mid-conversation â€” so density, state legibility and 44px targets
 * outrank everything expressive.
 *
 * Performance rules that are load-bearing here:
 *  - one 1Hz ticker drives every hold countdown (not one interval per slip)
 *  - drag moves with `transform` only; no layout property changes mid-drag
 *  - hour bands carry `content-visibility: auto`
 *  - the move is optimistic and reconciles against the server's conflict answer
 */

const ROW_PX = 30; // one 30-minute cell

export interface CourtColumn {
  id: string;
  name: string;
  tags: string[];
  enclosure: string;
  closedNote: string | null;
  hasWindow: boolean;
}

export interface SlipView {
  id: string;
  serial: number;
  courtId: string;
  startMinute: number;
  durationMinutes: number;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  source: BookingSource;
  openMatch: boolean;
  partySize: number;
  participantCount: number;
  customerName: string;
  total: Fils;
  outstanding: Fils;
  holdExpiresAt: string | null;
  holdIssuedAt: string | null;
  isSeries: boolean;
  blockReason: string | null;
  levelMin: number | null;
  levelMax: number | null;
}

export interface CustomerOption {
  id: string;
  name: string;
  altName: string;
  phone: string;
  tier: MembershipTier;
  level: number | null;
  blocked: boolean;
}

interface Strings {
  title: string;
  today: string;
  previous: string;
  next: string;
  closed: string;
  utilisation: string;
  takings: string;
  outstanding: string;
  justTaken: string;
  moved: string;
  moveFailed: string;
  noCourts: string;
  page: string;
  entry: Record<string, string>;
  status: Record<string, string>;
}

interface Props {
  locale: string;
  day: string;
  prevDay: string;
  nextDay: string;
  today: string;
  columns: CourtColumn[];
  rowMinutes: number[];
  step: number;
  slips: SlipView[];
  customers: CustomerOption[];
  takings: { cash: Fils; card: Fils; wallet: Fils; total: Fils };
  dueCount: number;
  utilisation: Record<string, number>;
  strings: Strings;
}

export function DayBook(props: Props) {
  const {
    locale,
    day,
    prevDay,
    nextDay,
    today,
    columns,
    rowMinutes,
    step,
    slips,
    customers,
    takings,
    dueCount,
    strings,
  } = props;

  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [draft, setDraft] = useState<EntryDraft>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Optimistic move: the slip lands where it was dropped immediately, and the
  // server's answer either keeps it there or snaps it back with a stamp.
  const [optimisticSlips, applyMove] = useOptimistic(
    slips,
    (current, move: { id: string; courtId: string; startMinute: number }) =>
      current.map((s) =>
        s.id === move.id
          ? { ...s, courtId: move.courtId, startMinute: move.startMinute }
          : s,
      ),
  );

  const firstMinute = rowMinutes[0] ?? 0;
  const lastMinute = (rowMinutes.at(-1) ?? 0) + step;

  const byCourt = useMemo(() => {
    const m = new Map<string, SlipView[]>();
    for (const s of optimisticSlips) {
      const list = m.get(s.courtId) ?? [];
      list.push(s);
      m.set(s.courtId, list);
    }
    return m;
  }, [optimisticSlips]);

  const occupied = useMemo(() => {
    const set = new Set<string>();
    for (const s of optimisticSlips) {
      if (s.status === "cancelled" || s.status === "expired") continue;
      for (let m = s.startMinute; m < s.startMinute + s.durationMinutes; m += step) {
        set.add(`${s.courtId}:${m}`);
      }
    }
    return set;
  }, [optimisticSlips, step]);

  const nowMinute = useNowMinute(day, today);

  const commitMove = useCallback(
    (id: string, courtId: string, startMinute: number) => {
      startTransition(async () => {
        applyMove({ id, courtId, startMinute });
        const res = await moveBooking({ id, courtId, day, startMinute });
        setNotice(
          res.ok
            ? { tone: "ok", text: strings.moved }
            : { tone: "bad", text: res.code === "taken" ? strings.justTaken : strings.moveFailed },
        );
      });
    },
    [applyMove, day, strings],
  );

  return (
    <div className="court-world court-surface min-h-dvh">
      {/* Masthead â€” the bound page's head, carrying date and page serial. */}
      <header className="sticky top-0 z-20 border-b-2 border-line/25 bg-court-deep text-line">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 px-4 py-2.5">
          <div className="flex items-baseline gap-3">
            <h1 className="painted text-[22px] leading-none tracking-tight">
              {strings.title}
            </h1>
            <span className="font-board text-[11px] uppercase tracking-[0.18em] text-amber">
              {strings.page} {day.replace(/-/g, "Â·")}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <NavLink href={`/console/calendar?d=${prevDay}`} label={strings.previous}>
              â€¹
            </NavLink>
            <Link
              href={`/console/calendar?d=${today}`}
              className="min-h-9 border border-amber px-3 py-1.5 font-board text-[11px] uppercase tracking-[0.14em] text-amber hover:bg-court-lit/30"
            >
              {strings.today}
            </Link>
            <NavLink href={`/console/calendar?d=${nextDay}`} label={strings.next}>
              â€º
            </NavLink>
          </div>
        </div>

        {/* Readings band â€” takings and outstanding, on the shell not the page. */}
        <div className="flex flex-wrap gap-x-8 gap-y-1 border-t border-line/20 px-4 py-2 font-board text-[11px] uppercase tracking-[0.1em]">
          <Figure label={strings.takings} value={formatMoney(takings.total, locale)} />
          <Figure label="Cash" value={formatMoney(takings.cash, locale)} />
          <Figure label="Card" value={formatMoney(takings.card, locale)} />
          <Figure
            label={strings.outstanding}
            value={String(dueCount)}
            tone={dueCount > 0 ? "due" : "ok"}
          />
        </div>
      </header>

      {/* The entry line â€” one sentence with open slots. */}
      <EntryLine
        locale={locale}
        day={day}
        draft={draft}
        onDraft={setDraft}
        columns={columns}
        customers={customers}
        rowMinutes={rowMinutes}
        occupied={occupied}
        step={step}
        strings={strings.entry}
        onDone={(text) => setNotice({ tone: "ok", text })}
        onError={(text) => setNotice({ tone: "bad", text })}
      />

      {notice && (
        <div
          role="status"
          className={cn(
            "flex items-center justify-between gap-3 border-b px-4 py-2 font-board text-[12px]",
            notice.tone === "ok"
              ? "border-line/15 bg-transparent text-line"
              : "border-line/25 bg-transparent text-clay",
          )}
        >
          <span>{notice.text}</span>
          <button
            onClick={() => setNotice(null)}
            className="min-h-9 px-2 uppercase tracking-[0.14em] text-line-dim"
          >
            Ã—
          </button>
        </div>
      )}

      {columns.length === 0 ? (
        <p className="p-8 text-center font-board text-[12px] uppercase tracking-[0.14em] text-line-dim">
          {strings.noCourts}
        </p>
      ) : (
        <div className="overflow-x-auto" ref={gridRef}>
          <div
            className="min-w-max"
            style={{
              // Time margin, then one column per court.
              display: "grid",
              gridTemplateColumns: `4.25rem repeat(${columns.length}, minmax(9.5rem, 1fr))`,
            }}
          >
            {/* Column heads */}
            <div className="sticky top-0 z-10 border-b border-line/25 bg-transparent px-2 py-2">
              <ColumnHead className="border-0 pb-0">â€”</ColumnHead>
            </div>
            {columns.map((c) => (
              <div
                key={c.id}
                className="sticky top-0 z-10 border-b border-line/25 border-e border-e-line/12 bg-transparent px-2 py-2 last:border-e-0"
              >
                <ColumnHead className="border-0 pb-0">{c.name}</ColumnHead>
                <div className="font-board text-[10px] uppercase tracking-[0.1em] text-line-dim">
                  {c.closedNote ?? c.enclosure}
                </div>
              </div>
            ))}

            {/* Body: one row per 30-minute cell */}
            {rowMinutes.map((minute) => (
              <Row
                key={minute}
                minute={minute}
                step={step}
                columns={columns}
                occupied={occupied}
                day={day}
                draft={draft}
                onPick={(courtId) =>
                  setDraft((d) => ({ ...d, courtId, startMinute: minute }))
                }
                onDrop={(courtId) => {
                  if (dragId) commitMove(dragId, courtId, minute);
                  setDragId(null);
                }}
                isNow={
                  nowMinute !== null &&
                  nowMinute >= minute &&
                  nowMinute < minute + step
                }
              />
            ))}

            {/* Slips, absolutely positioned over the ruling. */}
            {columns.map((c, colIndex) => (
              <div
                key={`slips-${c.id}`}
                className="pointer-events-none relative"
                style={{
                  gridColumn: colIndex + 2,
                  gridRow: `2 / span ${rowMinutes.length}`,
                }}
              >
                {(byCourt.get(c.id) ?? []).map((s) => (
                  <BookingSlip
                    key={s.id}
                    slip={s}
                    locale={locale}
                    firstMinute={firstMinute}
                    lastMinute={lastMinute}
                    step={step}
                    strings={strings.status}
                    dragging={dragId === s.id}
                    onDragStart={() => setDragId(s.id)}
                    onDragEnd={() => setDragId(null)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <footer className="border-t border-line/15 px-4 py-6 font-board text-[10px] uppercase tracking-[0.14em] text-line-dim">
        {pending ? "Writingâ€¦" : "Synthetic sample data â€” not real bookings"}
      </footer>
    </div>
  );
}

/** The time margin plus one cell per court, for a single 30-minute band. */
function Row({
  minute,
  step,
  columns,
  occupied,
  draft,
  onPick,
  onDrop,
  isNow,
}: {
  minute: number;
  step: number;
  columns: CourtColumn[];
  occupied: Set<string>;
  day: string;
  draft: EntryDraft;
  onPick: (courtId: string) => void;
  onDrop: (courtId: string) => void;
  isNow: boolean;
}) {
  const onHour = minute % 60 === 0;
  const label = clockOf(minute);

  return (
    <>
      <div
        className={cn(
          "hour-band relative border-e border-line/12 px-2 text-end",
          onHour ? "border-b border-line/15" : "",
          isNow && "bg-ball/10",
        )}
        style={{ height: ROW_PX }}
      >
        {onHour && (
          <span className="font-board text-[11px] tabular-nums text-line-dim">
            {label}
          </span>
        )}
        {isNow && (
          <span className="absolute inset-inline-0 bottom-0 block h-px bg-ball" />
        )}
      </div>

      {columns.map((c) => {
        const taken = occupied.has(`${c.id}:${minute}`);
        const closed = !c.hasWindow;
        const selected =
          draft.courtId === c.id && draft.startMinute === minute;

        return (
          <button
            key={`${c.id}:${minute}`}
            type="button"
            disabled={taken || closed}
            onClick={() => onPick(c.id)}
            onDragOver={(e) => {
              if (!taken && !closed) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (!taken && !closed) onDrop(c.id);
            }}
            className={cn(
              "hour-band relative border-e border-line/12 last:border-e-0",
              onHour && "border-b border-line/15",
              closed && "hatched cursor-not-allowed opacity-45",
              !closed && !taken && "hover:bg-ball/15",
              selected && "bg-ball/30 ring-1 ring-inset ring-ball",
            )}
            style={{ height: ROW_PX }}
            aria-label={`${c.name} ${label}`}
          >
            {isNow && (
              <span className="pointer-events-none absolute inset-inline-0 bottom-0 block h-px bg-ball" />
            )}
          </button>
        );
      })}
    </>
  );
}

function BookingSlip({
  slip,
  locale,
  firstMinute,
  lastMinute,
  step,
  strings,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  slip: SlipView;
  locale: string;
  firstMinute: number;
  lastMinute: number;
  step: number;
  strings: Record<string, string>;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const countdown = useCountdown(slip.holdExpiresAt);
  const progress = useHoldProgress(slip.holdIssuedAt, slip.holdExpiresAt);

  const top = ((slip.startMinute - firstMinute) / step) * ROW_PX;
  const height = Math.max((slip.durationMinutes / step) * ROW_PX - 2, 24);
  if (slip.startMinute >= lastMinute) return null;

  const stamp = statusStamp(slip, slip.participantCount);
  const stampText =
    stamp.key === "openSeats"
      ? `+${stamp.count} ${locale === "ar" ? "Ù…Ù‚Ø§Ø¹Ø¯" : "SEATS"}`
      : (strings[stamp.key] ?? stamp.key);

  const accent =
    slip.status === "held"
      ? "border-s-line/30"
      : slip.status === "blocked"
        ? "border-s-line/30"
        : slip.paymentStatus === "paid"
          ? "border-s-ball"
          : "border-s-clay";

  return (
    <article
      draggable={slip.status !== "blocked"}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "slip pointer-events-auto absolute inset-inline-1 overflow-hidden border-s-[3px] bg-transparent px-1.5 py-1",
        accent,
        slipTreatment(slip.status),
        dragging && "dragging slip-raised opacity-80",
        slip.status === "held" && "perforated-end",
      )}
      style={{
        top,
        height,
        // The perforated edge tears further open as the hold runs out.
        ["--perf" as string]: `${3 + progress * 6}px`,
      }}
      title={`#${slip.serial} Â· ${slip.customerName}`}
    >
      <Link
        href={`/console/bookings/${slip.id}`}
        className="flex h-full flex-col justify-between gap-0.5"
      >
        <div className="flex items-start justify-between gap-1">
          <span className="truncate text-[12px] font-semibold leading-tight text-line">
            {slip.blockReason ?? (slip.customerName || "â€”")}
          </span>
          <Serial value={slip.serial} className="shrink-0" />
        </div>

        {height > 44 && (
          <div className="flex items-end justify-between gap-1">
            <span className="font-board text-[10px] tabular-nums text-line-dim">
              {clockOf(slip.startMinute)}
              {slip.isSeries ? " â†»" : ""}
              {slip.total > 0 ? ` Â· ${formatMoney(slip.total, locale, { showCurrency: false })}` : ""}
            </span>
            <Stamp tone={stamp.tone} className="shrink-0">
              {countdown ? `${stampText} ${countdown}` : stampText}
            </Stamp>
          </div>
        )}

        {height <= 44 && (
          <Stamp tone={stamp.tone} className="self-start">
            {countdown ?? stampText}
          </Stamp>
        )}
      </Link>
    </article>
  );
}

function NavLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex min-h-9 min-w-9 items-center justify-center border border-line/20 text-[18px] leading-none text-line hover:bg-court-lit/30"
    >
      {children}
    </Link>
  );
}

function Figure({
  label,
  value,
  tone = "ok",
}: {
  label: string;
  value: string;
  tone?: "ok" | "due";
}) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-line-dim">{label}</span>
      <span
        className={cn(
          "tabular-nums",
          tone === "due" ? "text-ball" : "text-line",
        )}
      >
        {value}
      </span>
    </span>
  );
}

/** Minutes-from-06:00 rendered as a wall clock, past midnight included. */
function clockOf(minute: number): string {
  const h = Math.floor((minute + 6 * 60) / 60) % 24;
  const m = minute % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Where "now" falls on this page, or null when the page is not today. */
function useNowMinute(day: string, today: string): number | null {
  const [minute] = useState(() => {
    if (day !== today) return null;
    const now = new Date();
    const dubai = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Dubai" }),
    );
    const raw = dubai.getHours() * 60 + dubai.getMinutes() - 6 * 60;
    return raw < 0 ? raw + 24 * 60 : raw;
  });
  return minute;
}

export { InkButton, Reading };
