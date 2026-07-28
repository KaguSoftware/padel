import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/auth/password";
import { passwordProblem } from "@/auth/policy";
import { isEmailTaken } from "@/domain/errors";
import { accountsPort, normaliseEmail } from "@/data/memory/accounts";
import type { AccountsPort } from "@/data/ports";

/**
 * Accounts, at the two levels that matter: the credential itself, and the
 * uniqueness rule the database will enforce.
 *
 * The port is file-backed, so each test gets its own temp directory via
 * DATA_DIR. Sharing one would let an earlier test's account decide a later
 * test's "email is taken" — which is exactly the bug the suite exists to catch.
 */

const dirs: string[] = [];

function port(): AccountsPort {
  const dir = mkdtempSync(join(tmpdir(), "kagu-accounts-"));
  dirs.push(dir);
  process.env.DATA_DIR = dir;
  let seq = 0;
  return accountsPort(
    (prefix) => `${prefix}-${++seq}`,
    () => {},
  );
}

afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});

const CREDENTIAL = {
  passwordHash: "hash",
  passwordSalt: "salt",
  name: "Rania Saeed",
  role: "player" as const,
  customerId: null,
  staffId: null,
};

describe("passwords", () => {
  it("verifies the password it hashed", () => {
    const stored = hashPassword("correct horse battery");
    expect(verifyPassword("correct horse battery", stored)).toBe(true);
  });

  it("rejects the wrong password", () => {
    const stored = hashPassword("correct horse battery");
    expect(verifyPassword("correct horse batteru", stored)).toBe(false);
  });

  it("salts, so the same password does not produce the same hash", () => {
    // Two people choosing the same password must not be visible as two equal
    // hashes in the file.
    const a = hashPassword("the same password");
    const b = hashPassword("the same password");
    expect(a.hash).not.toBe(b.hash);
    expect(a.salt).not.toBe(b.salt);
  });

  it("survives a malformed stored hash rather than throwing", () => {
    // timingSafeEqual throws on a length mismatch, and a throw here would be a
    // 500 on the sign-in page rather than a refusal.
    expect(verifyPassword("anything", { hash: "not-hex", salt: "s" })).toBe(false);
    expect(verifyPassword("anything", { hash: "", salt: "s" })).toBe(false);
  });

  it("holds the length floor", () => {
    expect(passwordProblem("short")).not.toBeNull();
    expect(passwordProblem("a".repeat(10))).toBeNull();
  });
});

describe("email normalisation", () => {
  it("folds case and whitespace, because it is the key", () => {
    expect(normaliseEmail("  Rania@Kagu.AE ")).toBe("rania@kagu.ae");
  });
});

describe("accounts port", () => {
  let accounts: AccountsPort;

  beforeEach(() => {
    accounts = port();
  });

  it("creates an account and returns it without the credential", async () => {
    const created = await accounts.create({
      ...CREDENTIAL,
      email: "rania@kagu.ae",
    });

    expect(created.email).toBe("rania@kagu.ae");
    // The whole point of PublicAccount: a hash must not be able to reach a page
    // by way of a port that returned the whole row.
    expect(created).not.toHaveProperty("passwordHash");
    expect(created).not.toHaveProperty("passwordSalt");
  });

  it("refuses a duplicate email the way the unique index will", async () => {
    await accounts.create({ ...CREDENTIAL, email: "rania@kagu.ae" });

    await expect(
      accounts.create({ ...CREDENTIAL, email: "rania@kagu.ae" }),
    ).rejects.toSatisfy(isEmailTaken);
  });

  it("treats a differently-cased email as the same account", async () => {
    await accounts.create({ ...CREDENTIAL, email: "rania@kagu.ae" });

    await expect(
      accounts.create({ ...CREDENTIAL, email: "  Rania@Kagu.AE " }),
    ).rejects.toSatisfy(isEmailTaken);
  });

  it("finds an account for sign-in by any casing, with its credential", async () => {
    await accounts.create({
      ...CREDENTIAL,
      email: "rania@kagu.ae",
      passwordHash: "the-hash",
      passwordSalt: "the-salt",
    });

    const found = await accounts.findForSignIn("RANIA@kagu.ae");
    expect(found?.passwordHash).toBe("the-hash");
    expect(found?.passwordSalt).toBe("the-salt");
  });

  it("returns null for an unknown email rather than throwing", async () => {
    expect(await accounts.findForSignIn("nobody@kagu.ae")).toBeNull();
  });

  it("persists across a fresh port over the same directory", async () => {
    await accounts.create({ ...CREDENTIAL, email: "rania@kagu.ae" });

    // A new port on the same DATA_DIR is what a server restart looks like. The
    // whole reason accounts are file-backed is that this must still find her.
    const reopened = accountsPort(
      (p) => `${p}-x`,
      () => {},
    );
    expect(await reopened.findForSignIn("rania@kagu.ae")).not.toBeNull();
  });

  it("sees a write made through a different port instance", async () => {
    // THE REGRESSION. The port used to hold the rows in a closure, and Next
    // hands a server action and a page render different module instances — so
    // an account created down one path was invisible down the other and a
    // freshly created staff login could not sign in. Two instances over one
    // directory is that situation, and the file has to be the truth.
    const other = accountsPort(
      (p) => `${p}-other`,
      () => {},
    );

    await other.create({ ...CREDENTIAL, email: "nasser@kagu.ae" });

    expect(await accounts.findForSignIn("nasser@kagu.ae")).not.toBeNull();
    expect((await accounts.list()).map((a) => a.email)).toContain("nasser@kagu.ae");
  });

  it("does not lose a concurrent row when writing an update", async () => {
    const first = await accounts.create({ ...CREDENTIAL, email: "one@kagu.ae" });

    // Another instance adds a row this one has never read...
    const other = accountsPort(
      (p) => `${p}-other`,
      () => {},
    );
    await other.create({ ...CREDENTIAL, email: "two@kagu.ae" });

    // ...and this one then writes. A mutation applied to a stale snapshot would
    // write the whole file back without the second row, silently deleting it.
    await accounts.recordSignIn(first.id, new Date());

    expect((await accounts.list()).map((a) => a.email).sort()).toEqual([
      "one@kagu.ae",
      "two@kagu.ae",
    ]);
  });

  it("records a sign-in and can disable an account", async () => {
    const created = await accounts.create({
      ...CREDENTIAL,
      email: "rania@kagu.ae",
    });
    expect(created.lastSignInAt).toBeNull();

    const at = new Date("2026-07-28T18:00:00Z");
    expect((await accounts.recordSignIn(created.id, at)).lastSignInAt).toEqual(at);

    expect((await accounts.setActive(created.id, false, "usr-owner")).active).toBe(
      false,
    );
  });

  it("attaches a player login to its customer row", async () => {
    const created = await accounts.create({
      ...CREDENTIAL,
      email: "rania@kagu.ae",
    });
    const linked = await accounts.setCustomer(created.id, "cus-1");
    expect(linked.customerId).toBe("cus-1");
    expect((await accounts.get(created.id))?.customerId).toBe("cus-1");
  });
});
