/**
 * Money is integer minor units (fils). 100 fils = 1 AED.
 *
 * The brand makes a raw `number` a compile error at every boundary that takes a
 * price, which is the only reliable defence against a float creeping into a
 * total. Format once, at the edge — never parse and round during render.
 */

declare const filsBrand: unique symbol;

export type Fils = number & { readonly [filsBrand]: true };

export const ZERO = 0 as Fils;

/** Construct from a whole number of fils. Throws on a non-integer. */
export function fils(n: number): Fils {
  if (!Number.isInteger(n)) {
    throw new Error(`Fils must be a whole number of minor units, got ${n}`);
  }
  return n as Fils;
}

/** Construct from a major-unit amount, e.g. dirhams(90.5) -> 9050 fils. */
export function dirhams(n: number): Fils {
  return Math.round(n * 100) as Fils;
}

export function addFils(...amounts: Fils[]): Fils {
  return amounts.reduce((a, b) => a + b, 0) as Fils;
}

export function subFils(a: Fils, b: Fils): Fils {
  return (a - b) as Fils;
}

export function mulFils(amount: Fils, factor: number): Fils {
  return Math.round(amount * factor) as Fils;
}

/** Percentage of an amount, rounded to the nearest fil. `pct` is 0–100. */
export function percentOf(amount: Fils, pct: number): Fils {
  return Math.round((amount * pct) / 100) as Fils;
}

export function isZero(a: Fils): boolean {
  return a === 0;
}

export function maxFils(a: Fils, b: Fils): Fils {
  return (a > b ? a : b) as Fils;
}

/**
 * Split an amount across `n` shares so the shares always sum back to the total.
 *
 * AED 90.00 across 4 does not divide evenly; someone absorbs the remainder, and
 * who absorbs it must be deterministic or the till will not reconcile. The
 * remainder fils go to the earliest shares — in practice, the booker.
 */
export function splitEvenly(total: Fils, n: number): Fils[] {
  if (n <= 0) throw new Error("Cannot split across zero shares");
  const base = Math.floor(total / n);
  const remainder = total - base * n;
  return Array.from(
    { length: n },
    (_, i) => (base + (i < remainder ? 1 : 0)) as Fils,
  );
}

/**
 * Format for display. Latin digits in both locales: figures get compared down a
 * ledger column and copied onto receipts, and mixing ١٢٣ with 123 in a money
 * column is unreadable. Prose numbers elsewhere may use the locale's digits.
 */
export function formatMoney(
  amount: Fils,
  locale: string,
  opts: { showCurrency?: boolean } = {},
): string {
  const { showCurrency = true } = opts;
  const base = locale.startsWith("ar") ? "ar-AE-u-nu-latn" : "en-AE";
  return new Intl.NumberFormat(base, {
    style: showCurrency ? "currency" : "decimal",
    currency: "AED",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount / 100);
}
