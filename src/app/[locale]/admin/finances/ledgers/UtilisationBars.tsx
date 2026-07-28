/**
 * Utilisation by hour, as ruled columns on ledger paper.
 *
 * The non-hue-alone rule applies to charts too: the busiest band is
 * distinguished by a hatch pattern and a printed figure as well as by colour,
 * so the reading survives a monochrome print-out and a colour-blind reader.
 *
 * The time axis runs left-to-right in both locales. Reversing it under RTL
 * would satisfy symmetry and break comprehension — a physical axis stays
 * physical.
 */
export function UtilisationBars({
  rows,
}: {
  rows: { hour: number; clock: string; value: number }[];
}) {
  const peak = Math.max(...rows.map((r) => r.value), 0.0001);

  return (
    <div dir="ltr" className="scroll-x">
      <div className="flex min-w-max items-end gap-1.5 border-b border-line/25 pb-0 pt-2">
        {rows.map((r) => {
          const h = Math.max(2, Math.round((r.value / peak) * 132));
          const isPeak = r.value === peak && r.value > 0;
          return (
            <div key={r.hour} className="flex w-11 flex-col items-center gap-1">
              <span className="font-board text-[10px] tabular-nums text-line-dim">
                {r.value > 0 ? `${Math.round(r.value * 100)}` : ""}
              </span>
              <div
                className={[
                  "w-full border border-line/40",
                  isPeak ? "live-block hatched" : "bg-line/15",
                ].join(" ")}
                style={{ height: h }}
                role="img"
                aria-label={`${r.clock}: ${Math.round(r.value * 100)}% utilised`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex min-w-max gap-1.5 pt-1">
        {rows.map((r) => (
          <span
            key={r.hour}
            className="w-11 text-center font-board text-[9px] tabular-nums text-line-dim"
          >
            {r.hour % 2 === 0 ? r.clock.slice(0, 2) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
