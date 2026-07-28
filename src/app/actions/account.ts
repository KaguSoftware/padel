"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/data";
import { encodeClaims, SESSION_COOKIE, SIGNED_OUT, type Claims } from "@/auth/claims";
import { requireRole } from "@/auth/guard";
import { hashPassword, verifyPassword } from "@/auth/password";
import { MIN_PASSWORD_LENGTH } from "@/auth/policy";
import { isEmailTaken } from "@/domain/errors";
import { fils } from "@/lib/money";
import { normalisePhone } from "@/lib/text";
import type { ActionResult } from "./bookings";

/**
 * SIGN UP, SIGN IN, SIGN OUT.
 *
 * An account is a login; a customer is a person the club has taken money from.
 * Signing up creates the login and attaches it to a customer row — the existing
 * one if that phone number is already known, because a regular who has been
 * booked in by the front desk for a year and then makes an account online is
 * the same human, and minting a second customer would split their history,
 * their credit and their no-show count in half.
 *
 * Everything here writes the same `Claims` cookie the role switcher writes, so
 * the session shape is unchanged and `getClaims()` keeps its signature for the
 * day Supabase Auth takes this over.
 */

const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

async function writeSession(claims: Claims): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, encodeClaims(claims), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

const signUpSchema = z.object({
  name: z.string().trim().min(1, "Enter your name."),
  phone: z.string().trim().min(6, "Enter a phone number."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`),
});

/**
 * Public sign-up. Creates a player login.
 *
 * Note the order: the account is created FIRST, before the customer. If the
 * email turns out to be taken, the customer write has not happened yet, so a
 * failed sign-up cannot leave an orphan customer row behind for the front desk
 * to wonder about. The reverse order looks more natural and litters the members
 * list with ghosts.
 */
export async function signUp(
  input: z.input<typeof signUpSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid",
      message: parsed.error.issues[0]?.message ?? "Check the form.",
    };
  }

  const db = getDb();
  const { name, email, password } = parsed.data;
  const phone = normalisePhone(parsed.data.phone);
  const { hash, salt } = hashPassword(password);

  // The customer this login will act as — the existing row if the club already
  // knows this number, so a regular does not end up as two people.
  const existing = await db.customers.findByPhone(phone);

  let account;
  try {
    account = await db.accounts.create({
      email,
      passwordHash: hash,
      passwordSalt: salt,
      name,
      role: "player",
      // Filled in below once we know there is a customer to point at. Held as
      // null for the moment so the uniqueness failure costs nothing.
      customerId: existing?.id ?? null,
      staffId: null,
    });
  } catch (e) {
    if (isEmailTaken(e)) {
      return {
        ok: false,
        code: "email_taken",
        message: "An account already exists for that email. Sign in instead.",
      };
    }
    throw e;
  }

  let customerId = account.customerId;
  if (!customerId) {
    const created = await db.customers.create({
      phone,
      name,
      nameAr: null,
      email,
      level: null,
      tier: "guest",
      creditBalance: fils(0),
      noShowCount: 0,
      totalSpend: fils(0),
      blocked: false,
      blockedReason: null,
      notes: "Created by self sign-up",
    });
    customerId = created.id;
    await db.accounts.setCustomer(account.id, customerId);
  }

  await writeSession({
    userId: account.id,
    role: "player",
    name: account.name,
    customerId,
  });

  revalidatePath("/", "layout");
  return { ok: true, data: { id: account.id } };
}

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
});

export async function signIn(
  input: z.input<typeof signInSchema>,
): Promise<ActionResult<{ role: string }>> {
  const parsed = signInSchema.safeParse(input);
  const wrong: ActionResult<never> = {
    ok: false,
    code: "bad_credentials",
    message: "That email and password do not match an account.",
  };
  if (!parsed.success) return wrong;

  const db = getDb();
  const account = await db.accounts.findForSignIn(parsed.data.email);

  // Hash even when there is no such account, against a throwaway credential, so
  // that a missing email and a wrong password cost the same time to answer.
  // Returning early on "no such user" makes the response time itself a way to
  // find out who has an account here.
  const credential = account
    ? { hash: account.passwordHash, salt: account.passwordSalt }
    : { hash: "00".repeat(64), salt: "no-such-account" };
  const matches = verifyPassword(parsed.data.password, credential);

  if (!account || !matches) return wrong;
  if (!account.active) {
    return {
      ok: false,
      code: "denied",
      message: "That account has been disabled. Speak to the club.",
    };
  }

  await db.accounts.recordSignIn(account.id, new Date());
  await writeSession({
    userId: account.id,
    role: account.role,
    name: account.name,
    customerId: account.customerId,
  });

  revalidatePath("/", "layout");
  return { ok: true, data: { role: account.role } };
}

/**
 * Sign out.
 *
 * Writes the signed-out sentinel rather than clearing the cookie: an absent
 * cookie is what a first-time visitor has, and this prototype opens as the
 * front desk so the admin is reviewable without seeding a login. Clearing it
 * would put the user straight back to being staff, which reads as sign-out
 * being broken. See `SIGNED_OUT` in src/auth/claims.ts.
 */
export async function signOut(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, SIGNED_OUT, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  revalidatePath("/", "layout");
}

const staffAccountSchema = z.object({
  name: z.string().trim().min(1, "Enter a name."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`),
  role: z.enum(["owner", "manager", "staff", "coach"]),
  phone: z.string().trim().default(""),
});

/**
 * Create an account for someone who works here.
 *
 * Owner only — the same role that `manage_staff` names in the capability table,
 * because handing out a login is handing out the till. The check throws rather
 * than returning a refusal: a mutation that is not permitted must fail loudly.
 */
export async function createStaffAccount(
  input: z.input<typeof staffAccountSchema>,
): Promise<ActionResult<{ id: string }>> {
  const actor = await requireRole("owner");

  const parsed = staffAccountSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid",
      message: parsed.error.issues[0]?.message ?? "Check the form.",
    };
  }

  const db = getDb();
  const { name, email, password, role } = parsed.data;
  const { hash, salt } = hashPassword(password);

  const staff = await db.staff.save({
    id: "",
    name,
    nameAr: name,
    role,
    phone: normalisePhone(parsed.data.phone),
    active: true,
  });

  try {
    const account = await db.accounts.create({
      email,
      passwordHash: hash,
      passwordSalt: salt,
      name,
      role,
      customerId: null,
      staffId: staff.id,
    });

    await db.audit.append({
      actorId: actor.userId,
      action: "account.create_staff",
      entity: "account",
      entityId: account.id,
      summary: `${actor.name} created a ${role} login for ${name}`,
      summaryAr: `${actor.name} أنشأ حساب ${role} لـ ${name}`,
      amount: null,
      reason: null,
    });

    revalidatePath("/[locale]/admin/staff", "page");
    return { ok: true, data: { id: account.id } };
  } catch (e) {
    if (isEmailTaken(e)) {
      return {
        ok: false,
        code: "email_taken",
        message: "An account already exists for that email.",
      };
    }
    throw e;
  }
}

export async function setAccountActive(
  id: string,
  active: boolean,
): Promise<ActionResult<{ id: string }>> {
  const actor = await requireRole("owner");
  const db = getDb();
  await db.accounts.setActive(id, active, actor.userId);
  revalidatePath("/[locale]/admin/staff", "page");
  return { ok: true, data: { id } };
}
