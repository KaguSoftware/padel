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

/**
 * Signed out, explicitly.
 *
 * "No cookie" cannot mean signed out here, because no cookie is also what a
 * first-time visitor has, and this prototype has to open as the front desk so
 * the console is reviewable without seeding a login first. So signing out
 * writes this sentinel instead of clearing the cookie: absent means "has not
 * chosen yet", this value means "chose to leave". Without the distinction,
 * Sign out appeared to do nothing.
 */
export const SIGNED_OUT = "signed-out";

export interface Claims {
  userId: string;
  role: Role;
  name: string;
  /** Set for `player` sessions — the customer row they act as. */
  customerId: string | null;
}

/**
 * The prototype's default identity, used until someone switches role or signs
 * in. It is the OWNER so the whole console — finances, staff, audit, pricing —
 * is reviewable end to end without seeding a login first. Switch to any lower
 * role from the rail's role switcher to see a front-desk or coach view.
 */
export const DEFAULT_CLAIMS: Claims = {
  userId: "usr-owner-1",
  role: "owner",
  name: "Majed Ahdab",
  customerId: null,
};

export async function getClaims(): Promise<Claims | null> {
  try {
    const jar = await cookies();
    const raw = jar.get(SESSION_COOKIE)?.value;
    // No cookie, OR an explicit public sign-out, both fall back to the review
    // owner: the console must stay reachable for review no matter what the
    // public sign-in state is. The *public* honesty (showing Sign in after a
    // sign-out) is handled separately by `getSessionClaims`, so this no longer
    // needs to return null for the signed-out sentinel — doing so only ever
    // locked the reviewer out of the admin they were trying to open.
    if (!raw || raw === SIGNED_OUT) return DEFAULT_CLAIMS;
    return decodeClaims(raw);
  } catch {
    return null;
  }
}

/**
 * Claims for a *chosen* session only.
 *
 * `getClaims` hands the admin the prototype default when there is no cookie, so
 * the console is reviewable without seeding a login. On the public site that
 * same default read as "signed in" and showed Sign out — plus an admin link —
 * to a first-time visitor who had signed in to nothing. This is the honest
 * read for the marketing/booking surface: the default identity is treated as
 * signed-out, so a visitor sees Sign in, while the console still opens on the
 * default for review. A genuinely signed-in player or staff member (a real
 * cookie) is returned as themselves in both places.
 */
export async function getSessionClaims(): Promise<Claims | null> {
  try {
    const jar = await cookies();
    const raw = jar.get(SESSION_COOKIE)?.value;
    if (!raw || raw === SIGNED_OUT) return null;
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
