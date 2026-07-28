import "server-only";
import type { Role } from "@/data/types";
import { type Claims, getClaims } from "./claims";

export type { Claims };

/**
 * THE single guard. One copy.
 *
 * A sibling project accumulated thirteen copy-pasted variants of this that had
 * already drifted apart, seven of which paid a network round-trip each. There
 * is one here and there will stay one.
 *
 * Authorization is checked per action, server-side. Route middleware is a
 * convenience, never the boundary — and when Supabase lands, RLS is the real
 * boundary and this becomes a UX affordance on top of it.
 */

export class NotAuthorised extends Error {
  readonly required: Role[];
  readonly actual: Role | null;
  constructor(required: Role[], actual: Role | null) {
    super(`Requires ${required.join(" or ")}, got ${actual ?? "signed out"}`);
    this.name = "NotAuthorised";
    this.required = required;
    this.actual = actual;
  }
}

export async function requireUser(): Promise<Claims> {
  const claims = await getClaims();
  if (!claims) throw new NotAuthorised(["player"], null);
  return claims;
}

export async function requireRole(...roles: Role[]): Promise<Claims> {
  const claims = await requireUser();
  if (!roles.includes(claims.role)) {
    throw new NotAuthorised(roles, claims.role);
  }
  return claims;
}

/** Anyone who works here. */
export const ADMIN_ROLES: Role[] = ["owner", "manager", "staff"];
/** Money and configuration. */
export const MANAGER_ROLES: Role[] = ["owner", "manager"];

export async function requireAdmin(): Promise<Claims> {
  return requireRole(...ADMIN_ROLES, "coach");
}

export async function requireManager(): Promise<Claims> {
  return requireRole(...MANAGER_ROLES);
}

/**
 * Non-throwing variants, for PAGES.
 *
 * A page that a front-desk member of staff is not allowed to open should say so
 * calmly, not return a 500. Throwing is right for actions — a refused mutation
 * must fail loudly — but a route is a navigation, and staff navigate into the
 * wrong module all day.
 *
 * The check is still server-side and still the real one; only the presentation
 * differs.
 */
export async function allowRole(...roles: Role[]): Promise<Claims | null> {
  const claims = await getClaims();
  if (!claims) return null;
  return roles.includes(claims.role) ? claims : null;
}

export async function allowManager(): Promise<Claims | null> {
  return allowRole(...MANAGER_ROLES);
}

export async function allowAdmin(): Promise<Claims | null> {
  return allowRole(...ADMIN_ROLES, "coach");
}

export function can(role: Role, capability: Capability): boolean {
  return CAPABILITIES[capability].includes(role);
}

export type Capability =
  | "view_admin"
  | "take_payment"
  | "apply_discount"
  | "cancel_booking"
  | "close_till"
  | "edit_pricing"
  | "edit_courts"
  | "view_reports"
  | "manage_staff"
  | "view_audit";

/**
 * Capability table rather than scattered role checks, so "who can give a
 * discount" is answerable by reading one object.
 */
const CAPABILITIES: Record<Capability, Role[]> = {
  view_admin: ["owner", "manager", "staff", "coach"],
  take_payment: ["owner", "manager", "staff"],
  apply_discount: ["owner", "manager"],
  cancel_booking: ["owner", "manager", "staff"],
  close_till: ["owner", "manager", "staff"],
  edit_pricing: ["owner", "manager"],
  edit_courts: ["owner", "manager"],
  view_reports: ["owner", "manager"],
  manage_staff: ["owner"],
  view_audit: ["owner", "manager"],
};
