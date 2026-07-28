"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";

/**
 * The mobile menu, as a panel that slides off the board's edge.
 *
 * Deliberately not a bottom strip: a strip either truncates the destinations or
 * shrinks them below a thumb's width, and this product has enough modules that
 * it did both.
 *
 * Behaviour a "just toggle a div" version gets wrong, and this does not: Escape
 * closes it, the page behind does not scroll, focus moves into the panel and
 * returns to the trigger on close, and it is a real dialog to a screen reader.
 *
 * It renders through a portal to <body> because the trigger lives inside a
 * header carrying `backdrop-blur`, and a backdrop-filter makes its element a
 * containing block for `position: fixed` descendants — so an in-place panel
 * resolves `inset-0` against the 60px header strip and clips its own links away.
 */
export function Drawer({
  open,
  onClose,
  title,
  children,
  side = "start",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  side?: "start" | "end";
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

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      returnTo.current?.focus?.();
    };
  }, [open, onClose]);

  // `open` can only become true from a click, so the server never reaches the
  // portal and there is nothing for hydration to disagree about.
  if (!open) return null;

  return createPortal(
    <div className="drawer-root fixed inset-0 z-50 md:hidden" role="presentation">
      {/* The court behind, dimmed. Tapping it closes. */}
      <button
        type="button"
        aria-label={`Close ${title}`}
        onClick={onClose}
        className="absolute inset-0 bg-court-deep/80 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        tabIndex={-1}
        className={cn(
          "drawer-panel safe-bottom absolute inset-y-0 flex w-[min(20rem,86vw)] flex-col border-line/20 bg-board outline-none",
          side === "start" ? "start-0 border-e" : "end-0 border-s",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line/20 px-4 py-3">
          <span
            id={labelId}
            className="font-board text-[10px] uppercase tracking-[0.28em] text-amber"
          >
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="flex min-h-11 min-w-11 items-center justify-center border border-line/25 text-[20px] leading-none text-line active:bg-line/10"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** The trigger: three painted lines. */
export function MenuButton({
  onClick,
  label,
  className,
}: {
  onClick: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-haspopup="dialog"
      className={cn(
        "flex min-h-11 min-w-11 items-center justify-center border border-line/25 text-line transition-colors active:bg-line/10 md:hidden",
        className,
      )}
    >
      <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden>
        <g stroke="currentColor" strokeWidth="2">
          <line x1="0" y1="1" x2="18" y2="1" />
          <line x1="0" y1="7" x2="18" y2="7" />
          <line x1="0" y1="13" x2="12" y2="13" />
        </g>
      </svg>
    </button>
  );
}
