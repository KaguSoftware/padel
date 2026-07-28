"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { useTranslations } from "next-intl";
import { moveBooking, resizeBooking } from "@/app/actions/bookings";
import { DEFAULT_DURATIONS } from "@/domain/slots";
import { VENUE_TZ } from "@/lib/time";
import type { Fils } from "@/lib/money";
import { cn } from "@/ui/cn";
import { InkButton, Segmented } from "@/ui/primitives";
import { useNow } from "@/ui/Ticker";
import { BookingCard } from "./BookingCard";
import { Compose } from "./Compose";
import { DayStrip } from "./DayStrip";
import { Lane } from "./Lane";
import { PeekPanel } from "./PeekPanel";
import { ShiftBar } from "./ShiftBar";
import { TimeAxis } from "./TimeAxis";
import {
  bandSpan,
  clockOf,
  minuteOfDayInVenue,
  snapMinute,
  spanIsFree,
  type ClosedRun,
} from "./geometry";
import { useBoardGesture } from "./useBoardGesture";
import type {
  Attention,
  AttentionKey,
  CourtLane,
  CustomerOption,
  DayMark,
  SlipView,
} from "./types";

/**
 * THE DAY BOARD — the order of play, from the control desk.
 *
 * Courts are lanes and time runs across them. The board used to be the other
 * way up: courts as columns, thirty-minute bands as rows, which made a
 * 06:00–02:00 day about forty bands tall. You saw four hours at a time, a
 * 90-minute booking was a 96px sliver, and the answer to "is court 3 free at
 * nine" was somewhere below the fold. On its side, the whole club is four to
 * six lanes and seven hours fit across a tablet.
 *
 * Three things are load-bearing here:
 *
 *  - ONE 1Hz ticker drives every hold countdown and the now line. Sixty
 *    intervals on a front-desk tablet is a jank generator, and the tablet is
 *    the whole product.
 *  - Every gesture is Pointer Events, so the move that previously only existed
 *    for a mouse now exists for a finger.
 *  - Moves and resizes are optimistic and reconcile against the server's
 *    conflict answer. The write is never preceded by a check — `SlotTakenError`
 *    is the authority, here and in Postgres.
 *
 * DIRECTION. The board is pinned to `dir="ltr"` and time runs left-to-right in
 * both locales. That is the design contract's existing rule for chart time axes
 * applied to the case that has now become one: reversing a time axis breaks
 * comprehension faster than it satisfies symmetry. Everything with words in it
 * — the court rail, the cards, the sheets — mirrors normally.
 */

/** The club's prime hours, marked on the axis. 17:00–23:00 → minutes from 06:00. */
const PEAK_FROM = 11 * 60;
const PEAK_TO = 17 * 60;

interface Props {
  locale: string;
  dir: "ltr" | "rtl";
  day: string;
  today: string;
  week: DayMark[];
  lanes: CourtLane[];
  rowMinutes: number[];
  step: number;
  slips: SlipView[];
  customers: CustomerOption[];
  takings: { cash: Fils; card: Fils; wallet: Fils; total: Fils };
  dueCount: number;
  utilisation: number;
  attention: Attention;
}

export function Board(props: Props) {
  const {
    locale,
    dir,
    day,
    today,
    week,
    lanes,
    rowMinutes,
    step,
    slips,
    customers,
    takings,
    dueCount,
    utilisation,
    attention,
  } = props;

  const t = useTranslations("calendar");
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [peekId, setPeekId] = useState<string | null>(null);
  const [filter, setFilter] = useState<AttentionKey>("all");
  const [focusedCard, setFocusedCard] = useState<string | null>(null);
  const [keyMove, setKeyMove] = useState<{
    id: string;
    courtId: string;
    startMinute: number;
  } | null>(null);
  const [cursor, setCursor] = useState<{ courtId: string; minute: number } | null>(null);
  const [draft, setDraft] = useState<{
    courtId: string;
    startMinute: number;
    durationMinutes: number;
  } | null>(null);

  const firstMinute = rowMinutes[0] ?? 0;
  const lastMinute = (rowMinutes.at(-1) ?? 0) + step;

  /**
   * Optimistic board. A move or a resize lands instantly and the server's answer
   * either keeps it there or the revalidation snaps it back with a notice.
   */
  const [optimistic, applyLocal] = useOptimistic(
    slips,
    (
      current,
      change:
        | { kind: "move"; id: string; courtId: string; startMinute: number }
        | { kind: "resize"; id: string; durationMinutes: number },
    ) =>
      current.map((s) => {
        if (s.id !== change.id) return s;
        return change.kind === "move"
          ? { ...s, courtId: change.courtId, startMinute: change.startMinute }
          : { ...s, durationMinutes: change.durationMinutes };
      }),
  );

  const byCourt = useMemo(() => {
    const m = new Map<string, SlipView[]>();
    for (const s of optimistic) {
      const list = m.get(s.courtId) ?? [];
      list.push(s);
      m.set(s.courtId, list);
    }
    for (const list of m.values()) list.sort((a, b) => a.startMinute - b.startMinute);
    return m;
  }, [optimistic]);

  /**
   * Which bands are taken, and by whom.
   *
   * The status filter mirrors `OCCUPYING_STATUSES` on the server exactly. It
   * used to exclude only `cancelled` and `expired`, so a no-show blocked its
   * band on the board while the server considered it free — staff could see a
   * slot they could not book and could not book a slot they could see.
   */
  const { occupied, occupantAt } = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of optimistic) {
      if (s.status !== "held" && s.status !== "confirmed" && s.status !== "blocked") {
        continue;
      }
      for (let m = s.startMinute; m < s.startMinute + s.durationMinutes; m += step) {
        map.set(`${s.courtId}:${m}`, s.id);
      }
    }
    return {
      occupied: new Set(map.keys()),
      occupantAt: (courtId: string, minute: number) => map.get(`${courtId}:${minute}`),
    };
  }, [optimistic, step]);

  const closedByCourt = useMemo(() => {
    const m = new Map<string, ClosedRun[]>();
    for (const l of lanes) {
      m.set(l.id, l.shut ? [{ fromMinute: firstMinute, toMinute: lastMinute }] : l.closedRuns);
    }
    return m;
  }, [lanes, firstMinute, lastMinute]);

  const canPlace = useCallback(
    (input: {
      courtId: string;
      startMinute: number;
      durationMinutes: number;
      ignoreBookingId?: string;
    }) =>
      spanIsFree({
        ...input,
        step,
        occupied,
        closedByCourt,
        lastMinute,
        occupantAt,
      }),
    [closedByCourt, lastMinute, occupantAt, occupied, step],
  );

  const commitMove = useCallback(
    (id: string, courtId: string, startMinute: number) => {
      startTransition(async () => {
        applyLocal({ kind: "move", id, courtId, startMinute });
        const res = await moveBooking({ id, courtId, day, startMinute });
        setNotice(
          res.ok
            ? { tone: "ok", text: t("moved") }
            : {
                tone: "bad",
                text: res.code === "taken" ? t("justTaken") : t("moveFailed"),
              },
        );
      });
    },
    [applyLocal, day, t],
  );

  const commitResize = useCallback(
    (id: string, durationMinutes: number) => {
      startTransition(async () => {
        applyLocal({ kind: "resize", id, durationMinutes });
        const res = await resizeBooking({ id, durationMinutes });
        setNotice(
          res.ok
            ? { tone: "ok", text: t("resized", { count: durationMinutes }) }
            : { tone: "bad", text: res.message },
        );
      });
    },
    [applyLocal, t],
  );

  // The board owns its own scroller handle; the gesture hook borrows it for
  // edge-scrolling. A ref that travels out of a hook and back into `ref={...}`
  // reads as a render-time ref access to the compiler.
  const scroller = useRef<HTMLDivElement>(null);

  const gesture = useBoardGesture({
    step,
    durations: DEFAULT_DURATIONS,
    lastMinute,
    scrollerRef: scroller,
    canPlace,
    onMove: commitMove,
    onResize: commitResize,
    onDraw: (courtId, startMinute, durationMinutes) =>
      setDraft({ courtId, startMinute, durationMinutes }),
    onTapCard: setPeekId,
    onTapBand: (courtId, minute) =>
      setDraft({ courtId, startMinute: minute, durationMinutes: DEFAULT_DURATIONS[1] }),
  });

  const nowMinute = useNowMinute(day, today);

  /**
   * Open on now, not on 06:00.
   *
   * Staff arriving at 19:00 do not want to scroll past thirteen hours of a day
   * that has already happened. It runs once per day change, before paint, so
   * there is no visible jump from the morning to the evening.
   */
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || nowMinute === null) return;
    const bandWidth = el.scrollWidth / Math.max(1, rowMinutes.length);
    const target = ((nowMinute - firstMinute) / step) * bandWidth - el.clientWidth * 0.3;
    el.scrollLeft = Math.max(0, target);
    // Once per day, not on every tick of the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  const jumpToNow = useCallback(() => {
    const el = scroller.current;
    if (!el || nowMinute === null) return;
    const bandWidth = el.scrollWidth / Math.max(1, rowMinutes.length);
    el.scrollTo({
      left: Math.max(
        0,
        ((nowMinute - firstMinute) / step) * bandWidth - el.clientWidth * 0.3,
      ),
      behavior: "smooth",
    });
  }, [firstMinute, nowMinute, rowMinutes.length, scroller, step]);

  /** Does this booking match the attention filter? Dimmed if not — never hidden. */
  const matches = useCallback(
    (s: SlipView) => {
      switch (filter) {
        case "all":
          return true;
        case "holds":
          return s.status === "held";
        case "unpaid":
          return (
            s.outstanding > 0 && (s.status === "confirmed" || s.status === "held")
          );
        case "seats":
          return s.openMatch && s.participantCount < s.partySize;
        case "blocked":
          return s.status === "blocked";
      }
    },
    [filter],
  );

  // -------------------------------------------------------------------------
  // Keyboard. The board is a grid: arrows walk the bands, and a booking can be
  // picked up and put down without a pointer at all.
  // -------------------------------------------------------------------------

  const laneIndex = useCallback(
    (courtId: string) => lanes.findIndex((l) => l.id === courtId),
    [lanes],
  );

  const onBandKeyDown = useCallback(
    (e: React.KeyboardEvent, courtId: string, minute: number) => {
      const i = laneIndex(courtId);
      let next: { courtId: string; minute: number } | null = null;

      switch (e.key) {
        case "ArrowRight":
          next = { courtId, minute: Math.min(minute + step, lastMinute - step) };
          break;
        case "ArrowLeft":
          next = { courtId, minute: Math.max(minute - step, firstMinute) };
          break;
        case "ArrowDown":
          next = { courtId: lanes[Math.min(i + 1, lanes.length - 1)].id, minute };
          break;
        case "ArrowUp":
          next = { courtId: lanes[Math.max(i - 1, 0)].id, minute };
          break;
        case "Home":
          next = { courtId, minute: firstMinute };
          break;
        case "End":
          next = { courtId, minute: lastMinute - step };
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          setDraft({
            courtId,
            startMinute: minute,
            durationMinutes: DEFAULT_DURATIONS[1],
          });
          return;
        default:
          return;
      }

      e.preventDefault();
      setCursor(next);
      // Focus follows the cursor, which is what makes the roving tabindex a
      // navigation rather than a state nobody can see.
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(
            `[data-band-court="${next.courtId}"][data-band-minute="${next.minute}"]`,
          )
          ?.focus();
      });
    },
    [firstMinute, laneIndex, lanes, lastMinute, step],
  );

  const onCardKeyDown = useCallback(
    (e: React.KeyboardEvent, slip: SlipView) => {
      // `m` picks a booking up. Arrows walk the ghost; Enter puts it down;
      // Escape leaves it where it was. A drag, without a pointer.
      if (!keyMove) {
        if (e.key.toLowerCase() === "m" && slip.status !== "blocked") {
          e.preventDefault();
          setKeyMove({
            id: slip.id,
            courtId: slip.courtId,
            startMinute: slip.startMinute,
          });
          setNotice({ tone: "ok", text: t("moveMode") });
        }
        return;
      }

      if (keyMove.id !== slip.id) return;
      const i = laneIndex(keyMove.courtId);

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          setKeyMove(null);
          setNotice(null);
          return;
        case "Enter":
        case " ": {
          e.preventDefault();
          const ok = canPlace({
            courtId: keyMove.courtId,
            startMinute: keyMove.startMinute,
            durationMinutes: slip.durationMinutes,
            ignoreBookingId: slip.id,
          });
          if (ok) commitMove(slip.id, keyMove.courtId, keyMove.startMinute);
          else setNotice({ tone: "bad", text: t("wontFit") });
          setKeyMove(null);
          return;
        }
        case "ArrowRight":
          e.preventDefault();
          setKeyMove({
            ...keyMove,
            startMinute: snapMinute(
              keyMove.startMinute + step,
              step,
              firstMinute,
              lastMinute,
            ),
          });
          return;
        case "ArrowLeft":
          e.preventDefault();
          setKeyMove({
            ...keyMove,
            startMinute: snapMinute(
              keyMove.startMinute - step,
              step,
              firstMinute,
              lastMinute,
            ),
          });
          return;
        case "ArrowDown":
          e.preventDefault();
          setKeyMove({ ...keyMove, courtId: lanes[Math.min(i + 1, lanes.length - 1)].id });
          return;
        case "ArrowUp":
          e.preventDefault();
          setKeyMove({ ...keyMove, courtId: lanes[Math.max(i - 1, 0)].id });
          return;
      }
    },
    [canPlace, commitMove, firstMinute, keyMove, laneIndex, lanes, lastMinute, step, t],
  );

  // The board's own Escape: leave move mode from anywhere.
  useEffect(() => {
    if (!keyMove) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setKeyMove(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keyMove]);

  const g = gesture.gesture;
  const gestureActive = g !== null;
  const peek = optimistic.find((s) => s.id === peekId) ?? null;
  const draftLane = lanes.find((l) => l.id === draft?.courtId);

  const filterOptions: { value: AttentionKey; label: string; count?: number }[] = [
    { value: "all", label: t("filters.all") },
    { value: "holds", label: t("filters.holds"), count: attention.holds },
    { value: "unpaid", label: t("filters.unpaid"), count: attention.unpaid },
    { value: "seats", label: t("filters.seats"), count: attention.seats },
    { value: "blocked", label: t("filters.blocked"), count: attention.blocked },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The day, the week, and the shift's figures. */}
      <div className="rule-hair flex flex-col gap-4 border-b px-5 py-4 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
          <DayStrip days={week} current={day} />
          <ShiftBar
            locale={locale}
            takings={takings}
            dueCount={dueCount}
            utilisation={utilisation}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <Segmented
            name={t("filters.label")}
            value={filter}
            options={filterOptions}
            onChange={setFilter}
          />
          {nowMinute !== null && (
            <InkButton size="sm" variant="quiet" onClick={jumpToNow}>
              {t("jumpToNow", { time: clockOf(nowMinute) })}
            </InkButton>
          )}
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className={cn(
            "rule-hair flex items-center justify-between gap-3 border-b px-5 py-2.5 text-[14px] sm:px-8",
            notice.tone === "ok" ? "text-line" : "text-clay",
          )}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label={t("dismiss")}
            className="min-h-9 px-2 text-line-dim transition-colors hover:text-line"
          >
            ×
          </button>
        </div>
      )}

      {lanes.length === 0 ? (
        <p className="board-label px-8 py-16 text-center">{t("noCourts")}</p>
      ) : (
        <div
          ref={scroller}
          dir="ltr"
          className={cn("scroll-x flex-1", gestureActive && "board-gesture")}
        >
          <div className="min-w-max">
            <TimeAxis
              rowMinutes={rowMinutes}
              step={step}
              peakFrom={PEAK_FROM}
              peakTo={PEAK_TO}
              railLabel={t("court")}
            />

            <div className="relative" role="grid" aria-label={t("title")}>
              {lanes.map((lane, i) => (
                <Lane
                  key={lane.id}
                  lane={lane}
                  index={i}
                  rowMinutes={rowMinutes}
                  step={step}
                  firstMinute={firstMinute}
                  occupied={occupied}
                  cursor={cursorFor(cursor, lane.id, i, rowMinutes)}
                  dir={dir}
                  bandHandlers={gesture.bandHandlers}
                  onCursor={(courtId, minute) => setCursor({ courtId, minute })}
                  onBandKeyDown={onBandKeyDown}
                >
                  {(byCourt.get(lane.id) ?? []).map((slip) => {
                    const ghosted =
                      (g?.kind === "move" && g.id === slip.id) ||
                      keyMove?.id === slip.id;
                    const shown = ghosted
                      ? {
                          ...slip,
                          courtId: g?.kind === "move" ? g.courtId : keyMove!.courtId,
                          startMinute:
                            g?.kind === "move" ? g.startMinute : keyMove!.startMinute,
                        }
                      : g?.kind === "resize" && g.id === slip.id
                        ? { ...slip, durationMinutes: g.durationMinutes }
                        : slip;

                    // A ghost belongs to the lane it is hovering, not the one
                    // it came from.
                    if (shown.courtId !== lane.id) return null;

                    return (
                      <BookingCard
                        key={slip.id}
                        slip={shown}
                        locale={locale}
                        dir={dir}
                        firstMinute={firstMinute}
                        step={step}
                        focused={focusedCard === slip.id}
                        moving={ghosted || g?.kind === "resize"}
                        dimmed={!matches(slip)}
                        gestureActive={gestureActive}
                        cardHandlers={gesture.cardHandlers({
                          id: slip.id,
                          courtId: slip.courtId,
                          startMinute: slip.startMinute,
                          durationMinutes: slip.durationMinutes,
                          movable: slip.status !== "blocked",
                        })}
                        handleHandlers={gesture.handleHandlers({
                          id: slip.id,
                          courtId: slip.courtId,
                          startMinute: slip.startMinute,
                          durationMinutes: slip.durationMinutes,
                        })}
                        onActivate={() => setPeekId(slip.id)}
                        onFocus={() => setFocusedCard(slip.id)}
                        onKeyDown={(e) => onCardKeyDown(e, slip)}
                      />
                    );
                  })}

                  {/* A card being drawn out of empty lane. */}
                  {g?.kind === "draw" && g.courtId === lane.id && (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-y-1 border-2 border-dashed",
                        g.valid ? "border-ball bg-ball/20" : "border-clay bg-clay/15",
                      )}
                      style={{
                        insetInlineStart: bandSpan(
                          (g.startMinute - firstMinute) / step,
                        ),
                        width: bandSpan(g.durationMinutes / step),
                      }}
                    />
                  )}

                  {/* Where a move would land. */}
                  {((g?.kind === "move" && g.courtId === lane.id) ||
                    (keyMove && keyMove.courtId === lane.id)) && (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-y-1 border-2 border-dashed",
                        g?.kind === "move" && !g.valid
                          ? "border-clay"
                          : "border-ball",
                      )}
                      style={{
                        insetInlineStart: bandSpan(
                          ((g?.kind === "move" ? g.startMinute : keyMove!.startMinute) -
                            firstMinute) /
                            step,
                        ),
                        width: bandSpan(
                          (g?.kind === "move"
                            ? g.durationMinutes
                            : (optimistic.find((s) => s.id === keyMove!.id)
                                ?.durationMinutes ?? step)) / step,
                        ),
                      }}
                    />
                  )}
                </Lane>
              ))}

              {/*
                NOW. A rule at the actual minute across every lane at once,
                never snapped to the nearest band — "is court 3 free right now"
                is the question this screen exists to answer, and a line up to
                half an hour away from the truth does not answer it.
              */}
              {nowMinute !== null &&
                nowMinute >= firstMinute &&
                nowMinute < lastMinute && (
                  <div
                    className="pointer-events-none absolute inset-y-0"
                    style={{
                      insetInlineStart: `calc(var(--rail-w) + ${bandSpan(
                        (nowMinute - firstMinute) / step,
                      )})`,
                    }}
                  >
                    <span className="absolute inset-y-0 block w-0.5 bg-ball" />
                    <span className="live-block absolute -top-px start-0 -translate-x-1/2 px-1.5 py-0.5 font-board text-[11px] font-bold leading-none tabular-nums">
                      {clockOf(nowMinute)}
                    </span>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      <footer className="rule-hair board-label border-t px-5 py-4 sm:px-8">
        {pending ? t("writing") : t("sampleData")}
      </footer>

      <PeekPanel
        slip={peek}
        locale={locale}
        onClose={() => setPeekId(null)}
        onNotice={(tone, text) => setNotice({ tone, text })}
      />

      {/* Keyed on the drawn span: a new drag mounts a new form, so the
          customer from the last entry cannot survive into this one. */}
      <Compose
        key={
          draft
            ? `${draft.courtId}:${draft.startMinute}:${draft.durationMinutes}`
            : "closed"
        }
        open={draft !== null}
        onClose={() => setDraft(null)}
        day={day}
        lane={draftLane}
        startMinute={draft?.startMinute}
        durationMinutes={draft?.durationMinutes}
        customers={customers}
        onWritten={(serial) => setNotice({ tone: "ok", text: t("written", { serial }) })}
        onError={(message) => setNotice({ tone: "bad", text: message })}
      />
    </div>
  );
}

/**
 * The roving tabindex.
 *
 * Exactly one band in the whole grid is tabbable, so Tab reaches the board once
 * and arrows do the walking — 200 tab stops for a five-court day is not
 * keyboard support, it is a keyboard trap with good intentions. Before the user
 * has picked a band, the first band of the first lane holds it.
 */
function cursorFor(
  cursor: { courtId: string; minute: number } | null,
  laneId: string,
  laneIndex: number,
  rowMinutes: number[],
): number | null {
  if (cursor) return cursor.courtId === laneId ? cursor.minute : null;
  return laneIndex === 0 ? (rowMinutes[0] ?? null) : null;
}

/**
 * Where "now" falls on this page, or null when the page is not today.
 *
 * Driven by the one 1Hz ticker, so the line actually moves down the board over
 * a shift. It was once computed at mount, which meant a tablet left open at the
 * desk all evening showed a now line stuck at whenever it was opened — on the
 * screen whose whole job is telling staff what is happening now.
 */
function useNowMinute(day: string, today: string): number | null {
  const now = useNow();
  if (day !== today || now === 0) return null;
  return minuteOfDayInVenue(now, VENUE_TZ);
}
