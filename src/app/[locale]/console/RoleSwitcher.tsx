"use client";

import { useTransition } from "react";
import type { Role } from "@/data/types";
import type { Claims } from "@/auth/claims";
import { switchRole } from "@/app/actions/session";

/**
 * Prototype-only identity switch.
 *
 * It exists so the capability table is demonstrable — a front-desk session
 * genuinely cannot apply a discount, and you can see that by switching. It
 * disappears when real auth lands; the `Claims` shape it writes is the same one
 * `getClaims()` will read from a verified JWT.
 */

const ROLES: { role: Role; userId: string; name: string; customerId: string | null }[] = [
  { role: "owner", userId: "usr-owner", name: "Layla Al Mheiri", customerId: null },
  { role: "manager", userId: "usr-manager", name: "Omar Haddad", customerId: null },
  { role: "staff", userId: "usr-desk-1", name: "Rania Saeed", customerId: null },
  { role: "coach", userId: "usr-coach-1", name: "Diego Márquez", customerId: null },
  { role: "player", userId: "cus-1", name: "Ahmed Al Nasr", customerId: "cus-1" },
];

export function RoleSwitcher({
  current,
  label,
  signedInAs,
  roleLabels,
}: {
  current: Claims | null;
  label: string;
  signedInAs: string;
  roleLabels: Record<Role, string>;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="px-1">
      <div className="font-board text-[10px] uppercase tracking-[0.14em] text-line-dim">
        {signedInAs}
      </div>
      <label className="sr-only" htmlFor="role-switch">
        {label}
      </label>
      <select
        id="role-switch"
        disabled={pending}
        value={current?.role ?? "staff"}
        onChange={(e) => {
          const next = ROLES.find((r) => r.role === e.target.value);
          if (next) start(() => void switchRole(next));
        }}
        className="min-h-9 w-full border-0 border-b border-line/20 bg-transparent py-1 text-[13px] text-line focus:border-amber focus:outline-none"
      >
        {ROLES.map((r) => (
          <option key={r.role} value={r.role} className="bg-court-deep text-line">
            {r.name} — {roleLabels[r.role]}
          </option>
        ))}
      </select>
    </div>
  );
}
