import { cn } from "./cn";

/**
 * THE BOARD's component grammar — one world across the whole product.
 *
 * The console is not a separate back-office aesthetic; it is the same
 * floodlit court, seen from the control desk. Panels are glass, headings are
 * line paint, figures are board digits, and optic yellow means exactly one
 * thing: available, or live.
 *
 * What changed in the comfort pass: the dot-matrix face was carrying every
 * running label in here at 9-11px uppercase. It now carries figures only —
 * clocks, money, serials, counters — and words are set as words. Spacing went
 * up across the board, because the scene is a standing user on the same screen
 * for eight hours, not a screenshot.
 *
 * The exported API is deliberately unchanged, so every module inherits the new
 * density without a per-page rewrite.
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
        "font-board text-[12px] tabular-nums tracking-[0.14em] text-amber",
        className,
      )}
    >
      {typeof value === "number" ? String(value).padStart(4, "0") : value}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Label — the single most-used element in the console, and the one that had
// ten different tracking values. Now it has one.
// ---------------------------------------------------------------------------

export function BoardLabel({
  children,
  className,
  size = "md",
  as: As = "span",
  ...rest
}: React.HTMLAttributes<HTMLElement> & {
  size?: "sm" | "md";
  as?: "span" | "div" | "dt" | "p" | "legend";
}) {
  return (
    <As
      className={cn("board-label", size === "sm" && "board-label-sm", className)}
      {...rest}
    >
      {children}
    </As>
  );
}

// ---------------------------------------------------------------------------
// Column head — the label strip over a table or a lane.
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
        "board-label board-label-sm rule-strong border-b pb-2",
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
  return <hr className={cn("rule-strong border-0 border-t", className)} />;
}

export function HairRule({ className }: { className?: string }) {
  return <hr className={cn("rule-hair border-0 border-t", className)} />;
}

// ---------------------------------------------------------------------------
// Buttons — painted blocks. The user is standing at a counter: 48px floor.
// ---------------------------------------------------------------------------

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet" | "danger";
  size?: "sm" | "md";
  /** Holds the button's own width while it works, so the row cannot reflow. */
  loading?: boolean;
};

export function InkButton({
  variant = "secondary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 font-stadium uppercase tracking-[0.06em]",
        "transition-[transform,background-color,border-color,color] duration-100",
        "active:translate-y-px disabled:pointer-events-none disabled:opacity-40",
        size === "md" ? "min-h-12 px-6 text-[13px]" : "min-h-11 px-4 text-[12px]",
        variant === "primary" && "live-block hover:brightness-110",
        variant === "secondary" &&
          "border border-line/35 text-line hover:border-line hover:bg-line/10",
        variant === "quiet" && "text-line-dim hover:bg-line/8 hover:text-line",
        variant === "danger" &&
          "border border-clay text-clay hover:bg-clay hover:text-line",
        className,
      )}
      {...rest}
    >
      {/* The label keeps its box while the button works — a spinner that
          replaces the text makes every toolbar jump on every action. */}
      <span className={cn("inline-flex items-center gap-2", loading && "invisible")}>
        {children}
      </span>
      {loading && <Ticks className="absolute" />}
    </button>
  );
}

/**
 * The working indicator: three board lamps stepping, not a spinning ring.
 * A rotating circle is the one motion this world does not have.
 */
export function Ticks({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block h-1 w-1.5 bg-current opacity-30"
          style={{
            animation: "tick-step 900ms steps(1, end) infinite",
            animationDelay: `${i * 300}ms`,
          }}
        />
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Fields — a lit channel, not an input well. 16px, because anything smaller
// makes iOS zoom the whole page on focus and the tablet is the product.
// ---------------------------------------------------------------------------

const FIELD = [
  "min-h-13 w-full border-0 border-b-2 border-line/25 bg-line/5 px-3.5 py-2.5",
  "font-body text-[16px] text-line placeholder:text-line-dim/80",
  "focus:border-ball focus:bg-line/10 focus:outline-none",
  "disabled:cursor-not-allowed disabled:opacity-45",
  "transition-colors duration-100",
].join(" ");

// `ComponentProps` and not `InputHTMLAttributes`: React 19 passes `ref` as an
// ordinary prop to function components, and the caller needs to reach the field
// to focus it when a sheet opens.
export function RuledInput({ className, ...rest }: React.ComponentProps<"input">) {
  return <input className={cn(FIELD, className)} {...rest} />;
}

export function RuledSelect({
  className,
  children,
  ...rest
}: React.ComponentProps<"select">) {
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
    <label htmlFor={htmlFor} className={cn("board-label mb-1.5 block", className)}>
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
    <section className={cn("glass-pane p-6 sm:p-7", className)}>
      {(title || actions || serial) && (
        <header className="rule-strong mb-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-3 border-b pb-4">
          <h2 className="painted text-[20px] leading-none">{title}</h2>
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

/** A figure on the board: a plain label, and the numeral doing the talking. */
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
      <div className="board-label">{label}</div>
      <div className={cn("painted mt-2 text-[34px] tabular-nums", toneClass)}>
        {value}
      </div>
      {sub && <div className="board-label board-label-sm mt-1.5">{sub}</div>}
    </div>
  );
}

/**
 * Empty state: an unlit row on the board. It names what would be here and how
 * it gets here — "nothing yet" tells a new member of staff nothing.
 */
export function EmptyLine({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 border border-dashed border-line/20 px-6 py-14 text-center">
      <p className="board-label max-w-md text-balance">{children}</p>
      {action}
    </div>
  );
}

/**
 * Loading: the shape of the row that is coming, not a spinner in the middle of
 * an empty page. Staff read position as much as content.
 */
export function Skeleton({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn("bg-line/8 motion-safe:animate-pulse", className)}
      {...rest}
    />
  );
}

// ---------------------------------------------------------------------------
// Toolbar — the strip of controls over a module's content. One shape, so the
// filter row on the customers page and the one on the board are the same
// object rather than two hand-rolled flex rows that drift.
// ---------------------------------------------------------------------------

export function Toolbar({
  children,
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "scroll-x rule-hair flex items-center gap-2 border-b px-4 py-3 sm:px-6",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * Segmented control — a row of painted blocks where exactly one is chosen.
 * Radio semantics, not a row of buttons, so a keyboard user arrows through it.
 */
export function Segmented<T extends string>({
  name,
  value,
  options,
  onChange,
  className,
}: {
  name: string;
  value: T;
  options: { value: T; label: React.ReactNode; count?: number }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className={cn("flex gap-px", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 border px-3.5 text-[13px] transition-colors duration-100",
              on
                ? "border-line bg-line/15 text-line"
                : "border-line/25 text-line-dim hover:border-line/45 hover:text-line",
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className="font-board text-[12px] tabular-nums text-amber">
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
