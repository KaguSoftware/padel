"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";

/**
 * THE PEEK SHEET — a record opened without leaving the board.
 *
 * The console's highest-frequency action used to be a full page navigation:
 * tap a booking, lose the day book, act, navigate back, find your place again.
 * Staff do that dozens of times a shift, usually mid-sentence with the person
 * standing at the counter. The board must stay on the screen.
 *
 * It portals to <body> for the same reason the drawer does: the board scrolls
 * inside its own `overflow-x: auto` container, and an absolutely positioned
 * panel inside a scroll container is clipped by it. A portal is the only way
 * out that does not involve making the board not scroll.
 *
 * Behaviour a naive version gets wrong and this does not: Escape closes it,
 * the page behind does not scroll, focus enters the panel and returns to
 * whatever opened it, focus is trapped while it is open, and it is a real
 * dialog to a screen reader.
 *
 * Side sheet from `lg`, bottom sheet below — a 375px-wide side panel is not a
 * panel, it is the whole screen with a seam down one edge.
 */
export function Sheet({
  open,
  onClose,
  title,
  serial,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  serial?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const labelId = useId();

  useEffect(() => {
    if (!open) return;

    returnTo.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    function focusables(): HTMLElement[] {
      const root = panelRef.current;
      if (!root) return [];
      return Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      // Trap. Without this, Tab walks out of the sheet and into the board
      // behind it, where the user is now operating a thing they cannot see.
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || active === panelRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = previousOverflow;
      returnTo.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="drawer-root fixed inset-0"
      style={{ zIndex: "var(--z-peek)" }}
      role="presentation"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 bg-court-deep/75"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        tabIndex={-1}
        className={cn(
          "sheet-panel absolute flex flex-col border-line/25 bg-board outline-none",
          // Bottom sheet on a phone, side sheet from lg.
          "safe-bottom inset-x-0 bottom-0 max-h-[86dvh] border-t",
          "lg:inset-y-0 lg:end-0 lg:start-auto lg:max-h-none lg:w-[27rem] lg:border-s lg:border-t-0",
        )}
      >
        <header className="rule-strong flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 id={labelId} className="painted truncate text-[20px]">
              {title}
            </h2>
            {serial && <div className="mt-1.5">{serial}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={typeof title === "string" ? `Close ${title}` : "Close"}
            className="-me-1 flex min-h-11 min-w-11 shrink-0 items-center justify-center border border-line/25 text-[20px] leading-none text-line transition-colors hover:border-line hover:bg-line/10"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          {children}
        </div>

        {footer && (
          <footer className="rule-strong border-t px-5 py-4">{footer}</footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
