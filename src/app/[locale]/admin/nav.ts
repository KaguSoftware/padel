/**
 * The console's destinations, declared once.
 *
 * This list used to exist twice — byte for byte, in the server layout and in
 * the client mobile nav — because a server component cannot hand component
 * references across the RSC boundary. The fix is not to duplicate the list but
 * to stop putting components in it: the array holds a mark *name*, and each
 * side looks the mark up in the registry it can reach.
 *
 * The rail is deliberately short. The cash book, the ledgers, the rate card and
 * the audit log are four views of ONE job — what did we take, where are the
 * leaks, who gave that discount — so they live behind a single FINANCES entry
 * with its own section rail, instead of as four siblings the owner hunts
 * through one at a time.
 */

import type { MarkName } from "@/ui/marks";

export interface NavEntry {
  href: string;
  /** Key into the `nav` message namespace. */
  key: string;
  mark: MarkName;
}

/**
 * The day book is the job; everything else is an errand run between customers.
 * It is separated in the rail rather than sorted alphabetically among the rest,
 * because staff reach for it a hundred times a shift and for `tournaments`
 * roughly never.
 */
export const NAV_PRIMARY: readonly NavEntry[] = [
  { href: "/admin/calendar", key: "calendar", mark: "ledger" },
] as const;

export const NAV_REST: readonly NavEntry[] = [
  { href: "/admin/customers", key: "customers", mark: "card" },
  { href: "/admin/finances", key: "finances", mark: "drawer" },
  { href: "/admin/courts", key: "courts", mark: "courts" },
  { href: "/admin/academy", key: "coaching", mark: "racket" },
  { href: "/admin/shop", key: "shop", mark: "shelf" },
  { href: "/admin/tournaments", key: "tournaments", mark: "bracket" },
  { href: "/admin/staff", key: "staff", mark: "staff" },
] as const;

export const NAV: readonly NavEntry[] = [...NAV_PRIMARY, ...NAV_REST];

/**
 * A destination is current when it is the page or an ancestor of it, so
 * `/admin/bookings/0142` still lights the day book — you did not leave the
 * calendar, you looked at one of its entries.
 */
export function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Which module the user is in, for the mobile bar's title. Defaults to the board. */
export function currentEntry(pathname: string): NavEntry {
  return NAV.find((n) => isCurrent(pathname, n.href)) ?? NAV[0];
}
