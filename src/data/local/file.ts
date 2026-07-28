import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * LOCAL PERSISTENCE, for the things a demo must not lose.
 *
 * The seed data is regenerated on every boot and that is correct — it is
 * synthetic trading and it is supposed to move with the calendar. Accounts are
 * the opposite: someone signs up, closes the tab, comes back tomorrow and
 * expects to still exist. Holding them in the in-memory store would mean every
 * restart silently deleted every account anyone had made, which reads as the
 * sign-up being broken rather than as a prototype limitation.
 *
 * So they are written to a JSON file next to the project. It is not a database
 * and it does not pretend to be one — no transactions, no concurrent-writer
 * safety beyond the rename below. It sits behind the same repository port that
 * Postgres will implement, so nothing above the port knows the difference.
 *
 * ⚠️ This writes to disk, which works in dev and on a normal Node host. A
 * read-only or ephemeral filesystem (Vercel's lambdas, most containers) will
 * make writes fail and accounts vanish between requests. `DATA_DIR` can point
 * this somewhere writable; on the day the Supabase driver lands, this file
 * stops being used at all.
 */

function pathFor(name: string): string {
  // Read per call rather than at module load, so a test can point this at a
  // temp directory without the import order deciding the answer.
  const dir = process.env.DATA_DIR ?? join(process.cwd(), ".data");
  return join(dir, `${name}.json`);
}

/** Reads a JSON collection, or returns the fallback if it is not there yet. */
export function readCollection<T>(name: string, revive: (raw: unknown) => T): T[] {
  const file = pathFor(name);
  if (!existsSync(file)) return [];

  try {
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (!Array.isArray(parsed)) return [];
    return parsed.map(revive);
  } catch {
    // A corrupt file must not take the whole app down on boot. Losing the
    // accounts in a prototype is recoverable; a server that will not start is
    // not, and the failure would present as "the site is down".
    return [];
  }
}

/**
 * Writes the whole collection.
 *
 * Write-then-rename, because a process killed halfway through a plain write
 * leaves a truncated file, and the next boot then reads zero accounts and looks
 * exactly like a wipe. Rename is atomic on the same filesystem.
 */
export function writeCollection<T>(name: string, rows: T[]): void {
  const file = pathFor(name);
  mkdirSync(dirname(file), { recursive: true });

  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(rows, null, 2), "utf8");
  renameSync(tmp, file);
}
