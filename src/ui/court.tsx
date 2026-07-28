/**
 * THE COURT — drawn to a real padel plan, and the sport's own notation.
 *
 * A padel court is 20m × 10m, split by a net, with a service line 6.95m from
 * the net on each side and a centre service line splitting each service box.
 * The back walls are glass, which is the whole point of the sport: the ball
 * plays off them.
 *
 * These are not decorative graphics. The line plan is the page's structural
 * grid, and the rebound trace is the one thing padel does that no other racket
 * sport does — angle in, angle out, off the glass.
 */

/**
 * The court's line marking, in plan, sized to whatever box it is dropped into.
 *
 * `paint` marks it out as the reader arrives at it instead of having it already
 * there — `pathLength={1}` normalises every line so the perimeter and a service
 * line draw at the same rate despite being wildly different lengths.
 */
export function CourtLines({
  className,
  paint = false,
}: {
  className?: string;
  paint?: boolean;
}) {
  const drawn = paint ? 1 : undefined;
  return (
    <svg
      viewBox="0 0 200 100"
      preserveAspectRatio="none"
      className={className}
      aria-hidden
      role="presentation"
    >
      <g
        className={paint ? "paint-lines" : undefined}
        fill="none"
        stroke="currentColor"
        strokeWidth="0.7"
        vectorEffect="non-scaling-stroke"
      >
        {/* pathLength normalises each line to 1, so a 592-unit perimeter and a
            70-unit service line draw over the same progress. */}
        {/* Perimeter */}
        <rect x="1" y="1" width="198" height="98" pathLength={drawn} />
        {/* Net */}
        <line
          x1="100"
          y1="1"
          x2="100"
          y2="99"
          strokeWidth="1.6"
          pathLength={drawn}
        />
        {/* Service lines, 6.95m each side of the net */}
        <line x1="30.5" y1="1" x2="30.5" y2="99" pathLength={drawn} />
        <line x1="169.5" y1="1" x2="169.5" y2="99" pathLength={drawn} />
        {/* Centre service lines, splitting each service box */}
        <line x1="30.5" y1="50" x2="100" y2="50" pathLength={drawn} />
        <line x1="100" y1="50" x2="169.5" y2="50" pathLength={drawn} />
      </g>
    </svg>
  );
}

/**
 * The rebound trace: a serve, the far player's return, and the ball coming off
 * the back glass — the shot that only exists in padel. Drawn live on load via
 * the `.trace` keyframes.
 */
export function ReboundTrace({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 100"
      preserveAspectRatio="none"
      className={className}
      aria-hidden
      role="presentation"
    >
      <path
        className="trace"
        d="M 52 68 Q 92 22 132 44 T 190 74 L 196 78 L 176 88 Q 140 96 118 74"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* The point of contact with the glass. */}
      <circle cx="196" cy="78" r="2" fill="currentColor" />
    </svg>
  );
}

/**
 * The court number plate bolted to the fence — a monumental outlined digit.
 * It is the wayfinding a player actually uses when they walk in: "court 3".
 */
export function CourtPlate({
  n,
  className,
}: {
  n: number | string;
  className?: string;
}) {
  return (
    <span className={`court-plate select-none ${className ?? ""}`} aria-hidden>
      {String(n).padStart(2, "0")}
    </span>
  );
}

/** A single padel ball, optic yellow with its seam. */
export function Ball({
  size = 14,
  className,
  live = false,
}: {
  size?: number;
  className?: string;
  live?: boolean;
}) {
  return (
    <span
      className={`ball-dot inline-block shrink-0 rounded-full bg-ball ${
        live ? "ball-live" : ""
      } ${className ?? ""}`}
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}
