/**
 * Authored marks, drawn in the world's grammar: 1.5px hairline strokes, square
 * terminals, no rounded joins, no filled pictograms. A generic icon set inside
 * a committed form is the gap wearing chrome.
 *
 * The court plan is the club's own geometry — a padel court's service lines and
 * net, which everyone in the building reads all day.
 */

const S = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "square",
  strokeLinejoin: "miter",
} as const;

type P = { className?: string; size?: number };

function Svg({
  children,
  className,
  size = 20,
  viewBox = "0 0 24 24",
}: P & { children: React.ReactNode; viewBox?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      className={className}
      aria-hidden
      role="presentation"
    >
      {children}
    </svg>
  );
}

/** The club mark: a padel court in plan, with its net and service lines. */
export function CourtMark({ className, size = 24 }: P) {
  return (
    <Svg className={className} size={size} viewBox="0 0 24 24">
      <rect x="3" y="1.5" width="18" height="21" {...S} />
      <line x1="3" y1="12" x2="21" y2="12" {...S} strokeWidth={2.2} />
      <line x1="3" y1="6.5" x2="21" y2="6.5" {...S} />
      <line x1="3" y1="17.5" x2="21" y2="17.5" {...S} />
      <line x1="12" y1="1.5" x2="12" y2="6.5" {...S} />
      <line x1="12" y1="17.5" x2="12" y2="22.5" {...S} />
    </Svg>
  );
}

/** Day book — a bound ledger seen edge-on, with its ruling. */
export function LedgerMark({ className, size = 20 }: P) {
  return (
    <Svg className={className} size={size}>
      <rect x="3" y="3" width="18" height="18" {...S} />
      <line x1="7" y1="3" x2="7" y2="21" {...S} />
      <line x1="3" y1="8" x2="21" y2="8" {...S} />
      <line x1="10" y1="12" x2="18" y2="12" {...S} />
      <line x1="10" y1="16" x2="18" y2="16" {...S} />
    </Svg>
  );
}

/** Cash book — a drawer with its coin channels. */
export function DrawerMark({ className, size = 20 }: P) {
  return (
    <Svg className={className} size={size}>
      <rect x="2.5" y="7" width="19" height="12" {...S} />
      <line x1="2.5" y1="11" x2="21.5" y2="11" {...S} />
      <line x1="8" y1="11" x2="8" y2="19" {...S} />
      <line x1="14" y1="11" x2="14" y2="19" {...S} />
      <line x1="9.5" y1="7" x2="9.5" y2="4.5" {...S} />
      <line x1="14.5" y1="7" x2="14.5" y2="4.5" {...S} />
      <line x1="9.5" y1="4.5" x2="14.5" y2="4.5" {...S} />
    </Svg>
  );
}

/** Rate card — a tariff plate with its ruled rows. */
export function TariffMark({ className, size = 20 }: P) {
  return (
    <Svg className={className} size={size}>
      <rect x="3.5" y="3" width="17" height="18" {...S} />
      <line x1="3.5" y1="8" x2="20.5" y2="8" {...S} />
      <line x1="15" y1="8" x2="15" y2="21" {...S} />
      <line x1="3.5" y1="13" x2="20.5" y2="13" {...S} />
      <line x1="3.5" y1="17" x2="20.5" y2="17" {...S} />
    </Svg>
  );
}

/** Member card — embossed, with its serial band. */
export function CardMark({ className, size = 20 }: P) {
  return (
    <Svg className={className} size={size}>
      <rect x="2" y="5" width="20" height="14" {...S} />
      <line x1="2" y1="9.5" x2="22" y2="9.5" {...S} />
      <line x1="5" y1="14" x2="12" y2="14" {...S} />
      <line x1="5" y1="16.5" x2="9" y2="16.5" {...S} />
      <rect x="16" y="13" width="3.5" height="3.5" {...S} />
    </Svg>
  );
}

/** Stamp block — the rubber stamp itself, for the audit log. */
export function StampMark({ className, size = 20 }: P) {
  return (
    <Svg className={className} size={size}>
      <rect x="3.5" y="17" width="17" height="4" {...S} />
      <path d="M8 17V13.5h8V17" {...S} />
      <path d="M10 13.5V9a2 2 0 0 1 4 0v4.5" {...S} />
      <line x1="6" y1="21" x2="18" y2="21" {...S} />
    </Svg>
  );
}

/** Racket, in outline — the academy. */
export function RacketMark({ className, size = 20 }: P) {
  return (
    <Svg className={className} size={size}>
      <ellipse cx="12" cy="8.5" rx="6.5" ry="7" {...S} />
      <line x1="12" y1="15.5" x2="12" y2="22" {...S} />
      <line x1="9.5" y1="22" x2="14.5" y2="22" {...S} />
      <line x1="8" y1="5.5" x2="8" y2="12" {...S} strokeWidth={0.8} />
      <line x1="12" y1="3" x2="12" y2="14" {...S} strokeWidth={0.8} />
      <line x1="16" y1="5.5" x2="16" y2="12" {...S} strokeWidth={0.8} />
      <line x1="6" y1="8.5" x2="18" y2="8.5" {...S} strokeWidth={0.8} />
      <line x1="7" y1="12" x2="17" y2="12" {...S} strokeWidth={0.8} />
    </Svg>
  );
}

/** A shelf of stock — the shop. */
export function ShelfMark({ className, size = 20 }: P) {
  return (
    <Svg className={className} size={size}>
      <line x1="3" y1="12" x2="21" y2="12" {...S} />
      <line x1="3" y1="20" x2="21" y2="20" {...S} />
      <rect x="5" y="6" width="4" height="6" {...S} />
      <rect x="11" y="8" width="3" height="4" {...S} />
      <rect x="16" y="5" width="4" height="7" {...S} />
      <rect x="6" y="15" width="5" height="5" {...S} />
      <rect x="13" y="16" width="6" height="4" {...S} />
    </Svg>
  );
}

/** A bracket — tournaments. */
export function BracketMark({ className, size = 20 }: P) {
  return (
    <Svg className={className} size={size}>
      <line x1="3" y1="5" x2="8" y2="5" {...S} />
      <line x1="3" y1="11" x2="8" y2="11" {...S} />
      <line x1="8" y1="5" x2="8" y2="11" {...S} />
      <line x1="8" y1="8" x2="13" y2="8" {...S} />
      <line x1="3" y1="15" x2="8" y2="15" {...S} />
      <line x1="3" y1="21" x2="8" y2="21" {...S} />
      <line x1="8" y1="15" x2="8" y2="21" {...S} />
      <line x1="8" y1="18" x2="13" y2="18" {...S} />
      <line x1="13" y1="8" x2="13" y2="18" {...S} />
      <line x1="13" y1="13" x2="21" y2="13" {...S} />
    </Svg>
  );
}

/** Ruled column chart — the reports. */
export function LedgersMark({ className, size = 20 }: P) {
  return (
    <Svg className={className} size={size}>
      <line x1="3" y1="21" x2="21" y2="21" {...S} />
      <line x1="3" y1="3" x2="3" y2="21" {...S} />
      <rect x="6" y="13" width="3" height="8" {...S} />
      <rect x="11" y="8" width="3" height="13" {...S} />
      <rect x="16" y="16" width="3" height="5" {...S} />
    </Svg>
  );
}

/** Staff — two figures reduced to their notation. */
export function StaffMark({ className, size = 20 }: P) {
  return (
    <Svg className={className} size={size}>
      <circle cx="9" cy="8" r="3.2" {...S} />
      <path d="M3.5 20v-2a5.5 5.5 0 0 1 11 0v2" {...S} />
      <circle cx="17.5" cy="9" r="2.4" {...S} />
      <path d="M16 14.2A4.4 4.4 0 0 1 21 18.5V20" {...S} />
    </Svg>
  );
}

/** Court set — the courts module. */
export function CourtsMark({ className, size = 20 }: P) {
  return (
    <Svg className={className} size={size}>
      <rect x="2.5" y="4" width="8" height="16" {...S} />
      <line x1="2.5" y1="12" x2="10.5" y2="12" {...S} strokeWidth={2} />
      <rect x="13.5" y="4" width="8" height="16" {...S} />
      <line x1="13.5" y1="12" x2="21.5" y2="12" {...S} strokeWidth={2} />
    </Svg>
  );
}

/** A locked door — a module this role may not open. */
export function LockMark({ className, size = 20 }: P) {
  return (
    <Svg className={className} size={size}>
      <rect x="5" y="10.5" width="14" height="10" {...S} />
      <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" {...S} />
      <line x1="12" y1="14" x2="12" y2="17" {...S} />
    </Svg>
  );
}

/** Perforation tear, used where a stub detaches. */
export function TearMark({ className, size = 20 }: P) {
  return (
    <Svg className={className} size={size}>
      <line x1="12" y1="2" x2="12" y2="22" {...S} strokeDasharray="2 3" />
    </Svg>
  );
}
