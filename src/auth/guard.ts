import "server-only";
import type { Role } from "@/data/types";
import { type Claims, getClaims } from "./claims";

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
export const CONSOLE_ROLES: Role[] = ["owner", "manager", "staff"];
/** Money and configuration. */
export const MANAGER_ROLES: Role[] = ["owner", "manager"];

export async function requireConsole(): Promise<Claims> {
  return requireRole(...CONSOLE_ROLES, "coach");
}

export async function requireManager(): Promise<Claims> {
  return requireRole(...MANAGER_ROLES);
}

export function can(role: Role, capability: Capability): boolean {
  return CAPABILITIES[capability].includes(role);
}

export type Capability =
  | "view_console"
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
  view_console: ["owner", "manager", "staff", "coach"],
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
