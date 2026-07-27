"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import type { Role } from "@/data/types";
import { type Claims, encodeClaims, SESSION_COOKIE } from "@/auth/claims";

/**
 * Prototype identity. Writes the same `Claims` shape a verified JWT will carry,
 * so `getClaims()` keeps its signature when Supabase Auth lands and nothing
 * above it changes.
 */
export async function switchRole(next: {
  role: Role;
  userId: string;
  name: string;
  customerId: string | null;
}): Promise<void> {
  const claims: Claims = {
    userId: next.userId,
    role: next.role,
    name: next.name,
    customerId: next.customerId,
  };

  const jar = await cookies();
  jar.set(SESSION_COOKIE, encodeClaims(claims), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  revalidatePath("/", "layout");
}
