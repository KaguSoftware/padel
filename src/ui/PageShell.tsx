import { cn } from "./cn";

/**
 * The head every admin module opens with.
 *
 * It used to open on `court-surface` — the floodlit court, four hard pools of
 * light under `mix-blend-mode: screen`. That is right on the public site and
 * wrong here: the console's scene is a counter under bright light, where those
 * pools are glare, and they were repainting on every page for a decoration
 * nobody at the front desk is admiring at hour six. The head is now the board
 * itself, flat and near-black, with the module name painted across it.
 *
 * One spacing rhythm throughout — more space above a heading than below it,
 * and a measure cap so a ledger does not stretch to 2,000px on a desk monitor.
 */
export function PageShell({
  title,
  serial,
  actions,
  children,
  note,
  bleed = false,
  guilloche = false,
}: {
  title: React.ReactNode;
  serial?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  note?: React.ReactNode;
  /** The day board manages its own scroll geometry; it takes the full width. */
  bleed?: boolean;
  /** Retained for API compatibility; the Board world marks documents with
   *  court line-plan rather than engraved ornament. */
  guilloche?: boolean;
}) {
  void guilloche;

  return (
    <div className="desk court-world flex min-h-dvh flex-col bg-court-deep">
      <header className="rule-strong border-b bg-board">
        <div
          className={cn(
            "flex flex-wrap items-end justify-between gap-x-8 gap-y-4 px-5 py-6 sm:px-8 sm:py-7",
            !bleed && "mx-auto w-full max-w-[var(--desk-max)]",
          )}
        >
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-2">
            <h1 className="painted text-[26px] sm:text-[30px]">{title}</h1>
            {serial && (
              <span className="font-board text-[13px] tabular-nums tracking-[0.12em] text-amber">
                {serial}
              </span>
            )}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
        </div>
        {note && (
          <p
            className={cn(
              "rule-hair board-label border-t px-5 py-3 sm:px-8",
              !bleed && "mx-auto w-full max-w-[var(--desk-max)]",
            )}
          >
            {note}
          </p>
        )}
      </header>

      {bleed ? (
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      ) : (
        <div className="mx-auto w-full max-w-[var(--desk-max)] flex-1 px-5 py-8 sm:px-8 sm:py-10">
          {children}
        </div>
      )}
    </div>
  );
}

/** The board's tabular readout. Column heads as words, figures as figures. */
export function LedgerTable({
  heads,
  children,
  className,
}: {
  heads: React.ReactNode[];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("scroll-x", className)}>
      <table className="w-full min-w-max border-collapse text-[14px]">
        <thead>
          <tr>
            {heads.map((h, i) => (
              <th
                key={i}
                scope="col"
                className="board-label rule-strong border-b px-4 py-3 text-start font-medium"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function LedgerRow({
  children,
  className,
  ...rest
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "rule-hair border-b align-middle transition-colors duration-100 hover:bg-line/8",
        className,
      )}
      {...rest}
    >
      {children}
    </tr>
  );
}

export function Cell({
  children,
  className,
  numeric,
  ...rest
}: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        // 52px row floor: the reader is standing, and a row they cannot land a
        // finger on is a row they will mis-tap under a queue.
        "h-13 px-4 py-3.5",
        numeric && "text-end font-board tabular-nums",
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  );
}
