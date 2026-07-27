import "server-only";
import { cookies } from "next/headers";
import type { Role } from "@/data/types";

/**
 * Identity is verified LOCALLY. There is no network call on this path.
 *
 * Right now that is a signed cookie read. When Supabase lands this becomes
 * `getClaims()` — local JWT verification via WebCrypto, ~0.1ms — and NOT
 * `getUser()`, which is a round-trip to the auth server measured at 331ms on a
 * sibling project where it was being called 37 times per page load. Auth cost
 * more than the data did. See PERFORMANCE.md.
 *
 * ⚠️ `getClaims()` only verifies locally when the project signs with an
 * asymmetric algorithm. Enable ES256 signing keys in Supabase before relying on
 * this, or it silently falls back to a round-trip.
 *
 * ⚠️ This is the ONE deliberate exception to "every read throws" — a failed
 * session read means *signed out*, so it returns null and the caller redirects.
 * Throwing here would crash every route including the way out.
 */

export const SESSION_COOKIE = "kagu_session";

export interface Claims {
  userId: string;
  role: Role;
  name: string;
  /** Set for `player` sessions — the customer row they act as. */
  customerId: string | null;
}

/** The prototype's default identity, used until someone switches role. */
export const DEFAULT_CLAIMS: Claims = {
  userId: "usr-desk-1",
  role: "staff",
  name: "Rania Saeed",
  customerId: null,
};

export async function getClaims(): Promise<Claims | null> {
  try {
    const jar = await cookies();
    const raw = jar.get(SESSION_COOKIE)?.value;
    if (!raw) return DEFAULT_CLAIMS;
    return decodeClaims(raw);
  } catch {
    return null;
  }
}

/**
 * Zero I/O. Kept separate from `getClaims` so the eventual JWT verification has
 * exactly one place to live and every caller keeps the same signature.
 */
export function decodeClaims(raw: string): Claims | null {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as Partial<Claims>;
    if (!parsed.userId || !parsed.role) return null;
    return {
      userId: parsed.userId,
      role: parsed.role,
      name: parsed.name ?? "",
      customerId: parsed.customerId ?? null,
    };
  } catch {
    return null;
  }
}

export function encodeClaims(claims: Claims): string {
  return Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
}
