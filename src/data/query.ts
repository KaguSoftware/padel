/**
 * Every query goes through one of these, WITH A LABEL.
 *
 * A failed query must THROW, not render a calm empty state. On this product the
 * distinction is not academic: an availability read that fails silently renders
 * as either a fully booked day or a completely free one, and staff act on what
 * the screen says. The same silence elsewhere once turned a missing migration
 * into an outage that looked like "no data".
 *
 * Wrap a QUERY, never a WAVE — wrapping the Promise.all loses which one failed.
 *
 * The one deliberate exception is the session read (src/auth/claims.ts), which
 * returns null instead of throwing: a failed session read means *signed out*,
 * and throwing there would crash every route including the way out.
 */

export class QueryError extends Error {
  readonly label: string;
  constructor(label: string, cause: unknown) {
    super(`Query failed: ${label}`);
    this.name = "QueryError";
    this.label = label;
    this.cause = cause;
  }
}

export async function rowsOrThrow<T>(
  label: string,
  p: Promise<T[]>,
): Promise<T[]> {
  try {
    const rows = await p;
    if (!Array.isArray(rows)) throw new Error("Expected an array");
    return rows;
  } catch (e) {
    throw new QueryError(label, e);
  }
}

export async function rowOrThrow<T>(
  label: string,
  p: Promise<T | null | undefined>,
): Promise<T> {
  let row: T | null | undefined;
  try {
    row = await p;
  } catch (e) {
    throw new QueryError(label, e);
  }
  if (row === null || row === undefined) {
    throw new QueryError(label, new Error("Expected exactly one row, got none"));
  }
  return row;
}

/** Nullable single-row read: absence is a legitimate answer, failure is not. */
export async function maybeRow<T>(
  label: string,
  p: Promise<T | null | undefined>,
): Promise<T | null> {
  try {
    return (await p) ?? null;
  } catch (e) {
    throw new QueryError(label, e);
  }
}

export async function countOrThrow(
  label: string,
  p: Promise<number>,
): Promise<number> {
  try {
    const n = await p;
    if (typeof n !== "number" || Number.isNaN(n)) {
      throw new Error("Expected a number");
    }
    return n;
  } catch (e) {
    throw new QueryError(label, e);
  }
}
