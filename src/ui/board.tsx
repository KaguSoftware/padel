import { cn } from "./cn";

/**
 * THE BOARD — the order-of-play board that hangs over the courts.
 *
 * A booking site IS this object: which court, what time, who is on, how many
 * seats are open. Rendering it as anything else was the mistake.
 *
 * Amber belongs to the mechanical digits. Optic yellow marks exactly one thing:
 * what is live or available to take. Nothing else in the system may use it.
 */

export function BoardPanel({
  children,
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("board-panel", className)} {...rest}>
      {children}
    </div>
  );
}

/** The board's head: a label strip in dot-matrix, above the rows. */
export function BoardHead({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-b border-line/20 px-3 py-2 font-board text-[11px] uppercase tracking-[0.28em] text-amber",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** One flap row. `flipKey` re-triggers the flap when the row's content changes. */
export function BoardRow({
  children,
  className,
  flipKey,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { flipKey?: string | number }) {
  return (
    <div
      key={flipKey}
      className={cn(
        "flap-row flap-in border-b border-line/10 last:border-b-0",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Mechanical digits, at whatever scale the composition needs. */
export function Digits({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn("board-digit", className)}>{children}</span>;
}

/**
 * Status, on the board's own terms.
 *
 * As in the console, state is never carried by hue alone — every status is a
 * WORD as well as a colour, because the board is read at a glance across a
 * room and in bright light.
 */
export type BoardState = "open" | "live" | "full" | "held" | "closed" | "seats";

const STATE_CLASS: Record<BoardState, string> = {
  open: "live-block",
  live: "bg-clay text-line",
  full: "bg-line/10 text-line-dim",
  held: "bg-amber text-court-deep",
  closed: "bg-transparent text-line-dim border border-line/20",
  seats: "live-block",
};

export function BoardChip({
  state,
  children,
  className,
}: {
  state: BoardState;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 font-board text-[11px] font-bold uppercase leading-none tracking-[0.16em]",
        STATE_CLASS[state],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * A big painted figure with its label — the readings on the first viewport.
 * Set in line paint, at a scale that carries across the court.
 */
export function PaintedFigure({
  label,
  value,
  sub,
  live = false,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  live?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="font-board text-[10px] uppercase tracking-[0.24em] text-line-dim">
        {label}
      </div>
      <div
        className={cn(
          "painted mt-1.5 text-[clamp(2.75rem,6vw,4.5rem)] tabular-nums",
          live && "live",
        )}
      >
        {value}
      </div>
      {sub && (
        <div className="font-board text-[10px] uppercase tracking-[0.18em] text-line-dim">
          {sub}
        </div>
      )}
    </div>
  );
}

/** The primary action: a painted block, unmissable, 48px+ on every screen. */
export function CourtButton({
  variant = "primary",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
}) {
  return (
    <button
      className={cn(
        "inline-flex min-h-14 items-center justify-center gap-2.5 px-7 font-stadium text-[13px] uppercase tracking-[0.1em] transition-transform duration-100",
        "active:translate-y-0.5 disabled:pointer-events-none disabled:opacity-40",
        variant === "primary"
          ? "live-block hover:brightness-110"
          : "border border-line/35 text-line hover:border-line hover:bg-line/10",
        className,
      )}
      {...rest}
    />
  );
}
