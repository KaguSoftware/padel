import { EmailTakenError } from "@/domain/errors";
import { readCollection, writeCollection } from "../local/file";
import type { AccountsPort, CreateAccountInput } from "../ports";
import type { Account, PublicAccount } from "../types";

/**
 * Accounts, file-backed.
 *
 * The rest of the prototype lives in memory and is regenerated every boot,
 * which is right for synthetic trading and wrong for a login: someone who signs
 * up and comes back tomorrow has to still exist. So this one collection is read
 * from disk on first use and written through on every mutation.
 *
 * The contract it implements is the one Postgres will implement — in
 * particular, a duplicate email raises `EmailTakenError` here for the same
 * reason it will raise it there, and for the same reason `SlotTakenError`
 * exists: so the sign-up screen's "that email is taken" path is written once
 * and is already correct on the day the database arrives.
 */

const COLLECTION = "accounts";

/** JSON has no Date, so the timestamps come back as strings. */
function revive(raw: unknown): Account {
  const r = raw as Record<string, unknown>;
  return {
    id: String(r.id),
    email: String(r.email),
    passwordHash: String(r.passwordHash),
    passwordSalt: String(r.passwordSalt),
    name: String(r.name ?? ""),
    role: r.role as Account["role"],
    customerId: (r.customerId as string | null) ?? null,
    staffId: (r.staffId as string | null) ?? null,
    active: r.active !== false,
    createdAt: new Date(String(r.createdAt)),
    lastSignInAt: r.lastSignInAt ? new Date(String(r.lastSignInAt)) : null,
  };
}

/** The email is the key, so it is normalised in exactly one place: here. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Strips the credential.
 *
 * Deliberately builds the result field by field rather than deleting from a
 * copy: a field added to `Account` later then has to be added here to escape,
 * instead of leaking the moment someone adds `resetToken`.
 */
function publicOf(a: Account): PublicAccount {
  return {
    id: a.id,
    email: a.email,
    name: a.name,
    role: a.role,
    customerId: a.customerId,
    staffId: a.staffId,
    active: a.active,
    createdAt: a.createdAt,
    lastSignInAt: a.lastSignInAt,
  };
}

export function accountsPort(
  nextId: (prefix: string) => string,
  audit: (e: {
    actorId: string;
    action: string;
    entity: string;
    entityId: string;
    summary: string;
    summaryAr: string;
  }) => void,
): AccountsPort {
  /**
   * Read the file every time. Deliberately no in-memory cache.
   *
   * A closure holding the rows looked like an obvious win and was a real bug:
   * Next gives a server action and a page render different module instances, so
   * each got its own copy, and an account created down one path was invisible
   * down the other — a staff login could be created and then not sign in. The
   * same thing happens across workers or processes in any real deployment. If
   * the file is the source of truth then it has to actually be read.
   *
   * It costs a sub-millisecond read of a small file, on paths that already pay
   * ~100ms to scrypt, and only when someone signs in or is created.
   */
  const load = (): Account[] => readCollection<Account>(COLLECTION, revive);

  /** Read-modify-write, so a mutation cannot be applied to a stale snapshot. */
  const mutate = <T,>(fn: (rows: Account[]) => T): T => {
    const rows = load();
    const result = fn(rows);
    writeCollection(COLLECTION, rows);
    return result;
  };

  return {
    async list() {
      return load().map(publicOf);
    },

    async get(id) {
      const found = load().find((a) => a.id === id);
      return found ? publicOf(found) : null;
    },

    async findForSignIn(email) {
      const key = normaliseEmail(email);
      return load().find((a) => a.email === key) ?? null;
    },

    async create(input: CreateAccountInput) {
      const email = normaliseEmail(input.email);

      const account = mutate((rows) => {
        // The uniqueness check and the insert are one synchronous step over one
        // freshly-read snapshot — the closest a single JS process gets to the
        // unique index doing it. It is here so the error exists; it is NOT an
        // invitation to check first from a call site, which would reopen the
        // race the constraint closes.
        if (rows.some((a) => a.email === email)) throw new EmailTakenError(email);

        const created: Account = {
          id: nextId("acc"),
          email,
          passwordHash: input.passwordHash,
          passwordSalt: input.passwordSalt,
          name: input.name,
          role: input.role,
          customerId: input.customerId,
          staffId: input.staffId,
          active: true,
          createdAt: new Date(),
          lastSignInAt: null,
        };
        rows.push(created);
        return created;
      });

      audit({
        actorId: account.id,
        action: "account.create",
        entity: "account",
        entityId: account.id,
        summary: `Account created for ${account.email} as ${account.role}`,
        summaryAr: `تم إنشاء حساب لـ ${account.email} بدور ${account.role}`,
      });

      return publicOf(account);
    },

    async setActive(id, active, actorId) {
      const account = mutate((rows) => {
        const found = rows.find((a) => a.id === id);
        if (!found) throw new Error(`No account ${id}`);
        found.active = active;
        return found;
      });

      audit({
        actorId,
        action: active ? "account.enable" : "account.disable",
        entity: "account",
        entityId: id,
        summary: `${active ? "Enabled" : "Disabled"} account ${account.email}`,
        summaryAr: `${active ? "تفعيل" : "تعطيل"} حساب ${account.email}`,
      });

      return publicOf(account);
    },

    async setCustomer(id, customerId) {
      return publicOf(
        mutate((rows) => {
          const found = rows.find((a) => a.id === id);
          if (!found) throw new Error(`No account ${id}`);
          found.customerId = customerId;
          return found;
        }),
      );
    },

    async recordSignIn(id, at) {
      // Deliberately unaudited. The audit log is for money-touching mutations
      // and is read by an owner looking for a leak; a row per sign-in would
      // bury that under noise.
      return publicOf(
        mutate((rows) => {
          const found = rows.find((a) => a.id === id);
          if (!found) throw new Error(`No account ${id}`);
          found.lastSignInAt = at;
          return found;
        }),
      );
    },
  };
}
