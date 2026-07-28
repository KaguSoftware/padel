"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { snapDuration } from "./geometry";

/**
 * THE BOARD'S HANDS.
 *
 * The old board moved bookings with HTML5 drag-and-drop, which does not fire on
 * touch. On a product whose stated thesis is "the tablet is the whole product",
 * the move gesture did not exist on the tablet — a member of staff at the
 * counter could look at the board and not rearrange it.
 *
 * Pointer Events instead: one code path for finger, stylus and mouse, with
 * `setPointerCapture` so the gesture survives the pointer leaving the element
 * it started on (which it does immediately, because you are dragging it).
 *
 * Three gestures live here:
 *   MOVE    press a card, drag, release on a free band
 *   RESIZE  press a card's trailing edge, drag, release at a sellable length
 *   DRAW    press empty lane, drag across, release — a booking, sized by hand
 *
 * Hit-testing is done with `elementFromPoint` against `data-band` attributes
 * rather than by arithmetic on bounding rects. That is deliberate: it is
 * correct under RTL, under horizontal scroll, and under the sticky court rail
 * without any of them being special-cased, and the board is already a grid of
 * real elements that know their own court and minute.
 *
 * A press only becomes a drag after 6px of travel, so a tap stays a tap and
 * opens the record instead of nudging a booking by half an hour.
 */

const DRAG_THRESHOLD_PX = 6;
const EDGE_SCROLL_ZONE_PX = 72;
const EDGE_SCROLL_SPEED_PX = 14;

export interface BandHit {
  courtId: string;
  minute: number;
}

export type Gesture =
  | {
      kind: "move";
      id: string;
      /** Where it would land if released now. */
      courtId: string;
      startMinute: number;
      durationMinutes: number;
      valid: boolean;
    }
  | {
      kind: "resize";
      id: string;
      courtId: string;
      startMinute: number;
      durationMinutes: number;
      valid: boolean;
    }
  | {
      kind: "draw";
      courtId: string;
      startMinute: number;
      durationMinutes: number;
      valid: boolean;
    };

interface Options {
  step: number;
  durations: readonly number[];
  lastMinute: number;
  /**
   * The board's horizontal scroller, owned by the caller.
   *
   * Passed in rather than created and returned here: a ref handed back out of a
   * hook and then attached with `ref={...}` reads, to the React Compiler, as
   * touching a ref during render. The component owns its own DOM handle.
   */
  scrollerRef: RefObject<HTMLDivElement | null>;
  /** Is this span placeable? Drives the live valid/invalid read-out. */
  canPlace: (input: {
    courtId: string;
    startMinute: number;
    durationMinutes: number;
    ignoreBookingId?: string;
  }) => boolean;
  onMove: (id: string, courtId: string, startMinute: number) => void;
  onResize: (id: string, durationMinutes: number) => void;
  onDraw: (courtId: string, startMinute: number, durationMinutes: number) => void;
  /** A press that never became a drag. */
  onTapCard: (id: string) => void;
  onTapBand: (courtId: string, minute: number) => void;
}

interface Press {
  originX: number;
  originY: number;
  started: boolean;
}

interface OnCard extends Press {
  id: string;
  courtId: string;
  startMinute: number;
  durationMinutes: number;
}

/** Three literal kinds rather than a `"card" | "handle"` member: the compiler
 *  only discriminates a union on a single literal per member. */
type Pending =
  | ({ kind: "card" } & OnCard)
  | ({ kind: "handle" } & OnCard)
  | ({ kind: "band"; courtId: string; minute: number } & Press)
  | null;

export function useBoardGesture(opts: Options) {
  const {
    step,
    durations,
    lastMinute,
    scrollerRef,
    canPlace,
    onMove,
    onResize,
    onDraw,
    onTapCard,
    onTapBand,
  } = opts;

  const [gesture, setGesture] = useState<Gesture | null>(null);
  const pending = useRef<Pending>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const edgeTimer = useRef<number | null>(null);

  /**
   * Set the gesture in state AND in a ref, together.
   *
   * `pointerup` can arrive in the same frame as the last `pointermove`, so the
   * commit handler cannot read state — its closure would still hold the
   * position from one band ago and drop the booking there. The ref is written
   * from an event handler, never during render.
   */
  const commitGesture = useCallback((next: Gesture | null) => {
    gestureRef.current = next;
    setGesture(next);
  }, []);

  const stopEdgeScroll = useCallback(() => {
    if (edgeTimer.current !== null) {
      cancelAnimationFrame(edgeTimer.current);
      edgeTimer.current = null;
    }
  }, []);

  /**
   * Drag a booking to 22:00 on a board that is only showing up to 18:00 and the
   * board follows. Without this the only way to move a booking across the
   * evening is to drop it, scroll, and pick it up again.
   */
  const runEdgeScroll = useCallback(
    (clientX: number) => {
      stopEdgeScroll();
      const el = scrollerRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      let delta = 0;
      if (clientX < rect.left + EDGE_SCROLL_ZONE_PX) delta = -EDGE_SCROLL_SPEED_PX;
      else if (clientX > rect.right - EDGE_SCROLL_ZONE_PX) delta = EDGE_SCROLL_SPEED_PX;
      if (delta === 0) return;

      const tick = () => {
        el.scrollLeft += delta;
        edgeTimer.current = requestAnimationFrame(tick);
      };
      edgeTimer.current = requestAnimationFrame(tick);
    },
    [scrollerRef, stopEdgeScroll],
  );

  useEffect(() => stopEdgeScroll, [stopEdgeScroll]);

  const hitBand = useCallback((x: number, y: number): BandHit | null => {
    const el = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>("[data-band-court]");
    if (!el) return null;
    const courtId = el.dataset.bandCourt;
    const minute = Number(el.dataset.bandMinute);
    if (!courtId || Number.isNaN(minute)) return null;
    return { courtId, minute };
  }, []);

  const finish = useCallback(() => {
    stopEdgeScroll();
    const g = gestureRef.current;
    const p = pending.current;
    pending.current = null;
    commitGesture(null);

    // A press that never travelled is a tap on whatever was pressed.
    if (p && !p.started) {
      if (p.kind === "band") onTapBand(p.courtId, p.minute);
      else if (p.kind === "card") onTapCard(p.id);
      return;
    }

    if (!g || !g.valid) return;
    if (g.kind === "move") onMove(g.id, g.courtId, g.startMinute);
    else if (g.kind === "resize") onResize(g.id, g.durationMinutes);
    else onDraw(g.courtId, g.startMinute, g.durationMinutes);
  }, [commitGesture, onDraw, onMove, onResize, onTapBand, onTapCard, stopEdgeScroll]);

  const handleMove = useCallback(
    (e: React.PointerEvent) => {
      const p = pending.current;
      if (!p) return;

      if (!p.started) {
        const travelled =
          Math.abs(e.clientX - p.originX) + Math.abs(e.clientY - p.originY);
        if (travelled < DRAG_THRESHOLD_PX) return;
        p.started = true;
      }

      runEdgeScroll(e.clientX);

      const hit = hitBand(e.clientX, e.clientY);
      if (!hit) return;

      if (p.kind === "card") {
        const valid = canPlace({
          courtId: hit.courtId,
          startMinute: hit.minute,
          durationMinutes: p.durationMinutes,
          ignoreBookingId: p.id,
        });
        commitGesture({
          kind: "move",
          id: p.id,
          courtId: hit.courtId,
          startMinute: hit.minute,
          durationMinutes: p.durationMinutes,
          valid,
        });
        return;
      }

      if (p.kind === "handle") {
        // The handle only ever changes length, never court or start: dragging
        // the tail of a booking onto court 4 is not a thing anyone means.
        const raw = hit.minute + step - p.startMinute;
        const next = snapDuration(Math.max(step, raw), durations);
        const valid = canPlace({
          courtId: p.courtId,
          startMinute: p.startMinute,
          durationMinutes: next,
          ignoreBookingId: p.id,
        });
        commitGesture({
          kind: "resize",
          id: p.id,
          courtId: p.courtId,
          startMinute: p.startMinute,
          durationMinutes: next,
          valid,
        });
        return;
      }

      // Drawing. The anchor is wherever the press landed, so a drag backwards
      // across the morning reads as naturally as one forwards.
      if (hit.courtId !== p.courtId) return;
      const from = Math.min(p.minute, hit.minute);
      const to = Math.max(p.minute, hit.minute) + step;
      const next = snapDuration(Math.max(step, to - from), durations);
      const clamped = Math.min(next, lastMinute - from);
      const valid =
        clamped >= durations[0] &&
        canPlace({
          courtId: p.courtId,
          startMinute: from,
          durationMinutes: clamped,
        });
      commitGesture({
        kind: "draw",
        courtId: p.courtId,
        startMinute: from,
        durationMinutes: Math.max(clamped, step),
        valid,
      });
    },
    [canPlace, commitGesture, durations, hitBand, lastMinute, runEdgeScroll, step],
  );

  const capture = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  return {
    gesture,

    /** Spread onto a booking card. */
    cardHandlers: (card: {
      id: string;
      courtId: string;
      startMinute: number;
      durationMinutes: number;
      movable: boolean;
    }) => ({
      onPointerDown: (e: React.PointerEvent) => {
        if (e.button !== 0 && e.pointerType === "mouse") return;
        if (!card.movable) return;
        capture(e);
        pending.current = {
          kind: "card",
          id: card.id,
          courtId: card.courtId,
          startMinute: card.startMinute,
          durationMinutes: card.durationMinutes,
          originX: e.clientX,
          originY: e.clientY,
          started: false,
        };
      },
      onPointerMove: handleMove,
      onPointerUp: finish,
      onPointerCancel: finish,
    }),

    /** Spread onto the resize grip at a card's trailing edge. */
    handleHandlers: (card: {
      id: string;
      courtId: string;
      startMinute: number;
      durationMinutes: number;
    }) => ({
      onPointerDown: (e: React.PointerEvent) => {
        if (e.button !== 0 && e.pointerType === "mouse") return;
        e.stopPropagation();
        capture(e);
        pending.current = {
          kind: "handle",
          id: card.id,
          courtId: card.courtId,
          startMinute: card.startMinute,
          durationMinutes: card.durationMinutes,
          originX: e.clientX,
          originY: e.clientY,
          started: false,
        };
      },
      onPointerMove: handleMove,
      onPointerUp: (e: React.PointerEvent) => {
        e.stopPropagation();
        finish();
      },
      onPointerCancel: finish,
    }),

    /** Spread onto an empty band. */
    bandHandlers: (band: { courtId: string; minute: number; free: boolean }) => ({
      onPointerDown: (e: React.PointerEvent) => {
        if (e.button !== 0 && e.pointerType === "mouse") return;
        if (!band.free) return;
        capture(e);
        pending.current = {
          kind: "band",
          courtId: band.courtId,
          minute: band.minute,
          originX: e.clientX,
          originY: e.clientY,
          started: false,
        };
      },
      onPointerMove: handleMove,
      onPointerUp: finish,
      onPointerCancel: finish,
    }),
  };
}
