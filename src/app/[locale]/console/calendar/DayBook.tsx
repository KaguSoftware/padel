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
 * THE DAY BOOK — the order-of-play board, from the control desk.
 *
 * Courts are columns, hours are rows, bookings are cards in the slots. Free
 * cells sit unlit and light to optic yellow under the cursor; taken cells are
 * inert; closed cells are hatched. Staff spend most of their day here,
 * standing, on a tablet, mid-conversation — so density, state legibility and
 * 44px targets outrank everything expressive.
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
    <div className="court-world min-h-dvh bg-court-deep">
      {/* The board's head: the day, the shift's running figures, the page keys. */}
      <header className="sticky top-0 z-20 border-b border-line/25 bg-board text-line">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-3">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="painted text-[clamp(1.3rem,2.6vw,1.9rem)]">
              {strings.title}
            </h1>
            <span className="board-digit text-[19px] leading-none">{day}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <NavLink href={`/console/calendar?d=${prevDay}`} label={strings.previous}>
              ‹
            </NavLink>
            <Link
              href={`/console/calendar?d=${today}`}
              className={cn(
                "flex min-h-11 items-center px-4 font-stadium text-[11px] uppercase tracking-[0.1em] transition-colors",
                day === today
                  ? "live-block"
                  : "border border-line/30 text-line hover:border-line",
              )}
            >
              {strings.today}
            </Link>
            <NavLink href={`/console/calendar?d=${nextDay}`} label={strings.next}>
              ›
            </NavLink>
          </div>
        </div>

        {/* Running figures for the shift, in board digits. */}
        <div className="flex flex-wrap gap-x-9 gap-y-2 border-t border-line/15 px-5 py-2.5">
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

      {/* The entry line — one sentence with open slots. */}
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
            ×
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
            {/* Court heads: the plate on the fence, over the column it owns. */}
            <div className="sticky top-0 z-10 border-b border-line/25 bg-board px-2 py-2.5">
              <ColumnHead className="border-0 pb-0">Hr</ColumnHead>
            </div>
            {columns.map((c, i) => (
              <div
                key={c.id}
                className="sticky top-0 z-10 border-b border-line/25 border-e border-e-line/12 bg-board px-2.5 py-2 last:border-e-0"
              >
                <div className="flex items-baseline gap-2">
                  <span className="board-digit text-[15px] leading-none">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="truncate font-stadium text-[11px] uppercase tracking-[0.07em] text-line">
                    {c.name}
                  </span>
                </div>
                <div className="mt-1 font-board text-[9px] uppercase tracking-[0.14em] text-line-dim">
                  {c.closedNote ?? c.enclosure}
                </div>
              </div>
            ))}

            {/* Body: one row per 30-minute cell */}
            {rowMinutes.map((minute) => (
              <Row
                key={minute}
                minute={minute}
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
        {pending ? "Writing…" : "Synthetic sample data — not real bookings"}
      </footer>
    </div>
  );
}

/** The time margin plus one cell per court, for a single 30-minute band. */
function Row({
  minute,
  columns,
  occupied,
  draft,
  onPick,
  onDrop,
  isNow,
}: {
  minute: number;
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
        )}
        style={{ height: ROW_PX }}
      >
        {onHour && (
          <span className="board-digit text-[13px] leading-none">{label}</span>
        )}
        {isNow && (
          <span className="absolute inset-inline-0 bottom-0 z-20 block h-0.5 bg-ball" />
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
              "hour-band relative border-e border-line/12 transition-colors duration-100 last:border-e-0",
              onHour && "border-b border-line/15",
              // An unlit cell is court surface seen through the board; a free
              // one lights under the cursor, which is how a board says "here".
              !closed && !taken && "bg-court-lit/12 hover:bg-ball/25",
              taken && !closed && "bg-transparent",
              closed && "hatched cursor-not-allowed bg-court-deep/70",
              selected && "bg-ball/40 ring-1 ring-inset ring-ball",
            )}
            style={{ height: ROW_PX }}
            aria-label={`${c.name} ${label}`}
          >
            {isNow && (
              <span className="pointer-events-none absolute inset-inline-0 bottom-0 z-20 block h-0.5 bg-ball" />
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
      ? `+${stamp.count} ${locale === "ar" ? "مقاعد" : "SEATS"}`
      : (strings[stamp.key] ?? stamp.key);

  // The card in the slot: a lit panel whose leading edge carries the state.
  const edge =
    slip.status === "held"
      ? "border-s-amber"
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
        "pointer-events-auto absolute inset-inline-1 overflow-hidden border border-line/20 border-s-[3px] bg-board/85 px-2 py-1.5 backdrop-blur-[1px]",
        "transition-shadow duration-100",
        edge,
        slipTreatment(slip.status),
        dragging && "dragging z-30 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.9)]",
      )}
      style={{
        top,
        height,
        // A hold's leading edge burns down as its TTL runs out. Not a progress
        // bar — the card is physically going away.
        boxShadow:
          slip.status === "held"
            ? `inset ${3 - progress * 3}px 0 0 0 var(--color-amber)`
            : undefined,
      }}
      title={`#${slip.serial} · ${slip.customerName}`}
    >
      <Link
        href={`/console/bookings/${slip.id}`}
        className="flex h-full flex-col justify-between gap-1"
      >
        <div className="flex items-start justify-between gap-1.5">
          <span className="truncate font-stadium text-[11px] uppercase leading-tight tracking-[0.03em] text-line">
            {slip.blockReason ?? (slip.customerName || "—")}
          </span>
          <Serial value={slip.serial} className="shrink-0 opacity-70" />
        </div>

        {height > 44 ? (
          <div className="flex items-end justify-between gap-1">
            <span className="board-digit text-[11px] leading-none">
              {clockOf(slip.startMinute)}
              {slip.isSeries ? " ↻" : ""}
              {slip.total > 0
                ? ` · ${formatMoney(slip.total, locale, { showCurrency: false })}`
                : ""}
            </span>
            <Stamp tone={stamp.tone} className="shrink-0">
              {countdown ? `${stampText} ${countdown}` : stampText}
            </Stamp>
          </div>
        ) : (
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
      className="flex min-h-11 min-w-11 items-center justify-center border border-line/30 text-[20px] leading-none text-line transition-colors hover:border-line hover:bg-line/10"
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
