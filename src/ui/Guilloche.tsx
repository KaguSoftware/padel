/**
 * Engraved hairline guilloche — the ornament of documents that must not be
 * forged. It appears on receipts, member cards, certificates and the marketing
 * masthead, and NOWHERE else. Ornament that is everywhere is decoration; this
 * world uses it as a claim about the document it sits on.
 *
 * Drawn as a spirograph so it is a few hundred bytes of path data rather than
 * an image, and deterministic from its parameters so a receipt's guilloche is
 * identical every time it is rendered.
 */

interface Props {
  /** Number of rotations. More = denser rosette. */
  petals?: number;
  ratio?: number;
  className?: string;
  stroke?: string;
  strokeWidth?: number;
  /** A band rather than a rosette — for the top of a receipt. */
  band?: boolean;
}

function rosettePath(petals: number, ratio: number, size: number): string {
  const R = size / 2;
  const r = R * ratio;
  const d = R * (1 - ratio) * 0.9;
  const steps = 720;
  const parts: string[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2 * petals;
    const k = (R - r) / r;
    const x = (R - r) * Math.cos(t) + d * Math.cos(k * t) + R;
    const y = (R - r) * Math.sin(t) - d * Math.sin(k * t) + R;
    parts.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return parts.join(" ");
}

export function Guilloche({
  petals = 7,
  ratio = 0.62,
  className,
  stroke = "currentColor",
  strokeWidth = 0.35,
  band = false,
}: Props) {
  const size = 200;

  if (band) {
    return (
      <svg
        viewBox="0 0 400 24"
        preserveAspectRatio="none"
        aria-hidden
        className={className}
        role="presentation"
      >
        {[0, 1, 2].map((row) => (
          <path
            key={row}
            d={waveBand(row)}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            opacity={0.55}
          />
        ))}
      </svg>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
      role="presentation"
      className={className}
    >
      <path
        d={rosettePath(petals, ratio, size)}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        opacity={0.7}
      />
      <path
        d={rosettePath(petals + 2, ratio * 0.88, size)}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        opacity={0.45}
      />
    </svg>
  );
}

function waveBand(row: number): string {
  const amp = 4 - row * 0.8;
  const phase = row * 1.7;
  const parts: string[] = [];
  for (let x = 0; x <= 400; x += 4) {
    const y =
      12 +
      Math.sin((x / 400) * Math.PI * 18 + phase) * amp +
      Math.sin((x / 400) * Math.PI * 43 + phase) * (amp / 3);
    parts.push(`${x === 0 ? "M" : "L"}${x},${y.toFixed(2)}`);
  }
  return parts.join(" ");
}
