import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

/**
 * Locale routing only.
 *
 * Authorization deliberately does NOT live here. Route-level guards are a
 * convenience; the real check is per-action and server-side (src/auth/guard.ts),
 * and when Supabase lands it is RLS. A middleware that is the only thing
 * standing between a player and the till is a middleware that will one day be
 * bypassed by a route it did not match.
 */
export default createMiddleware(routing);

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
