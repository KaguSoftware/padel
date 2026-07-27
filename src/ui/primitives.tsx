import { cn } from "./cn";

/**
 * THE BOARD's component grammar — one world across the whole product.
 *
 * The console is not a separate back-office aesthetic; it is the same
 * floodlit court, seen from the control desk. Panels are glass, headings are
 * line paint, figures are board digits, and optic yellow means exactly one
 * thing: available, or live.
 *
 * The exported API is deliberately unchanged from the first build, so every
 * module inherits the new world without a per-page rewrite.
 */

// ---------------------------------------------------------------------------
// Slip — the universal container. A glass pane, lit at its top edge.
// ---------------------------------------------------------------------------

export function Slip({
  children,
  className,
  accent,
  as: As = "div",
  ...rest
}: React.HTMLAttributes<HTMLElement> & {
  accent?: string;
  as?: "div" | "article" | "section" | "li";
}) {
  return (
    <As
      className={cn("glass-pane relative", accent && "border-s-2", accent, className)}
      {...rest}
    >
      {children}
    </As>
  );
}

/** Entry number, in the board's mechanical readout. */
export function Serial({
  value,
  className,
}: {
  value: number | string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-board text-[11px] tabular-nums tracking-[0.18em] text-amber",
        className,
      )}
    >
      {typeof value === "number" ? String(value).padStart(4, "0") : value}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Column head — dot-matrix label strip.
// ---------------------------------------------------------------------------

export function ColumnHead({
  children,
  className,
  align = "start",
}: {
  children: React.ReactNode;
  className?: string;
  align?: "start" | "end" | "center";
}) {
  return (
    <div
      className={cn(
        "border-b border-line/20 pb-1 font-board text-[10px] uppercase tracking-[0.24em] text-line-dim",
        align === "end" && "text-end",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function RedRule({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-line/25", className)} />;
}

export function HairRule({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-line/12", className)} />;
}

// ---------------------------------------------------------------------------
// Buttons — painted blocks. The user is standing at a counter: 48px floor.
// ---------------------------------------------------------------------------

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet" | "danger";
  size?: "sm" | "md";
};

export function InkButton({
  variant = "secondary",
  size = "md",
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-stadium uppercase tracking-[0.09em] transition-transform duration-100",
        "active:translate-y-0.5 disabled:pointer-events-none disabled:opacity-35",
        size === "md" ? "min-h-12 px-5 text-[12px]" : "min-h-11 px-3.5 text-[11px]",
        variant === "primary" && "live-block hover:brightness-110",
        variant === "secondary" &&
          "border border-line/35 text-line hover:border-line hover:bg-line/10",
        variant === "quiet" && "text-line-dim hover:text-line",
        variant === "danger" &&
          "border border-clay text-clay hover:bg-clay hover:text-line",
        className,
      )}
      {...rest}
    />
  );
}

// ---------------------------------------------------------------------------
// Fields — a lit channel, not an input well.
// ---------------------------------------------------------------------------

const FIELD = [
  "min-h-12 w-full border-0 border-b-2 border-line/25 bg-line/5 px-3 py-2",
  "font-body text-[15px] text-line placeholder:text-line-dim",
  "focus:border-ball focus:bg-line/10 focus:outline-none",
  "transition-colors duration-120",
].join(" ");

export function RuledInput({
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD, className)} {...rest} />;
}

export function RuledSelect({
  className,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(FIELD, "appearance-none", className)} {...rest}>
      {children}
    </select>
  );
}

export function FieldLabel({
  children,
  htmlFor,
  className,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "mb-1 block font-board text-[10px] uppercase tracking-[0.22em] text-line-dim",
        className,
      )}
    >
      {children}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Panels do not nest. One glass pane per region.
// ---------------------------------------------------------------------------

export function Panel({
  title,
  serial,
  children,
  className,
  actions,
}: {
  title?: React.ReactNode;
  serial?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}) {
  return (
    <section className={cn("glass-pane p-5", className)}>
      {(title || actions || serial) && (
        <header className="mb-4 flex flex-wrap items-baseline justify-between gap-3 border-b border-line/20 pb-2.5">
          <h2 className="painted text-[19px] leading-none">{title}</h2>
          <div className="flex items-center gap-3">
            {serial}
            {actions}
          </div>
        </header>
      )}
      {children}
    </section>
  );
}

/** A figure on the board: dot-matrix label, painted numeral. */
export function Reading({
  label,
  value,
  sub,
  tone = "ink",
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "ink" | "settle" | "rule" | "brass" | "void";
  className?: string;
}) {
  const toneClass = {
    ink: "text-line",
    settle: "text-ball",
    rule: "text-clay",
    brass: "text-amber",
    void: "text-line-dim",
  }[tone];

  return (
    <div className={cn("min-w-0", className)}>
      <div className="font-board text-[10px] uppercase tracking-[0.22em] text-line-dim">
        {label}
      </div>
      <div className={cn("painted mt-1 text-[30px] tabular-nums", toneClass)}>
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 font-board text-[10px] uppercase tracking-[0.16em] text-line-dim">
          {sub}
        </div>
      )}
    </div>
  );
}

/** Empty state: an unlit row on the board. */
export function EmptyLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-dashed border-line/20 py-10 text-center font-board text-[11px] uppercase tracking-[0.24em] text-line-dim">
      {children}
    </div>
  );
}
