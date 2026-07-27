import { CourtLines } from "./court";
import { cn } from "./cn";

/**
 * The head every console module opens with.
 *
 * The console is the control desk at the side of the same floodlit court, so
 * the page opens on court surface with the module name painted across it and
 * the board's readout beside it. One spacing rhythm throughout — more space
 * above a heading than below it.
 */
export function PageShell({
  title,
  serial,
  actions,
  children,
  note,
  guilloche = false,
}: {
  title: React.ReactNode;
  serial?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  note?: React.ReactNode;
  /** Retained for API compatibility; the Board world marks documents with
   *  court line-plan rather than engraved ornament. */
  guilloche?: boolean;
}) {
  return (
    <div className="court-world min-h-dvh bg-court-deep">
      <header className="court-surface relative overflow-hidden border-b border-line/20">
        {guilloche && (
          <CourtLines className="pointer-events-none absolute inset-0 h-full w-full text-line/25" />
        )}
        <div className="relative flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-4 py-5 sm:px-5 sm:py-6">
          <div className="flex flex-wrap items-baseline gap-4">
            <h1 className="painted text-[clamp(1.6rem,3.4vw,2.4rem)]">{title}</h1>
            {serial && (
              <span className="font-board text-[11px] uppercase tracking-[0.22em] text-amber">
                {serial}
              </span>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
        {note && (
          <p className="relative border-t border-line/15 px-4 py-2 font-board text-[11px] tracking-[0.08em] text-line-dim sm:px-5">
            {note}
          </p>
        )}
      </header>
      <div className="px-4 py-6 sm:px-5 sm:py-7">{children}</div>
    </div>
  );
}

/** The board's tabular readout. Column heads in dot-matrix, rows lit faintly. */
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
      <table className="w-full min-w-max border-collapse text-[13px]">
        <thead>
          <tr>
            {heads.map((h, i) => (
              <th
                key={i}
                scope="col"
                className="border-b border-line/25 px-2.5 py-2 text-start font-board text-[10px] uppercase tracking-[0.2em] text-line-dim"
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
        "border-b border-line/10 align-middle transition-colors duration-100 hover:bg-line/8",
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
        "px-2.5 py-2.5",
        numeric && "text-end font-board tabular-nums",
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  );
}
