import "server-only";
import { createMemoryDb } from "./memory/driver";
import type { Db } from "./ports";

/**
 * The driver factory.
 *
 * `DATA_DRIVER=memory` (the default) runs on authored sample data.
 * `DATA_DRIVER=supabase` will run on Postgres once the project exists — see
 * src/data/supabase/README.md and supabase/migrations/.
 *
 * Nothing above this line knows which one it got. That is the entire point of
 * the ports: the swap is a driver change, not a rewrite.
 */

export type DriverName = "memory" | "supabase";

export function driverName(): DriverName {
  return process.env.DATA_DRIVER === "supabase" ? "supabase" : "memory";
}

let cached: Db | null = null;

export function getDb(): Db {
  if (cached) return cached;

  if (driverName() === "supabase") {
    throw new Error(
      "The Supabase driver is not implemented yet. Set DATA_DRIVER=memory, " +
        "or implement src/data/supabase/driver.ts against src/data/ports.ts " +
        "and apply supabase/migrations/. See HANDOFF.md.",
    );
  }

  cached = createMemoryDb();
  return cached;
}

export type { Db } from "./ports";
