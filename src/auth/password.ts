import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Passwords, hashed with scrypt from the standard library.
 *
 * scrypt rather than a plain SHA: a password hash has to be *slow*, because the
 * threat is someone with the file trying billions of guesses offline, and a
 * fast hash is exactly what makes that cheap. No dependency is added for this —
 * node:crypto ships scrypt, and a password library would be a supply-chain
 * surface for something the platform already does correctly.
 *
 * The parameters below are the Node defaults (N=16384, r=8, p=1) at a 64-byte
 * key. When Supabase Auth lands this module is deleted, not ported — Supabase
 * owns the credential and this codebase should stop holding one.
 */

const KEY_LENGTH = 64;

export interface PasswordHash {
  hash: string;
  salt: string;
}

export function hashPassword(plaintext: string): PasswordHash {
  const salt = randomBytes(16).toString("hex");
  return { hash: scryptSync(plaintext, salt, KEY_LENGTH).toString("hex"), salt };
}

/**
 * Constant-time comparison.
 *
 * `===` on two hashes leaks how many leading bytes matched through how long it
 * took to answer, which is enough to reconstruct the hash a byte at a time.
 * The length guard is separate because `timingSafeEqual` throws rather than
 * returning false when the buffers differ in length.
 */
export function verifyPassword(
  plaintext: string,
  expected: PasswordHash,
): boolean {
  const actual = scryptSync(plaintext, expected.salt, KEY_LENGTH);
  let target: Buffer;
  try {
    target = Buffer.from(expected.hash, "hex");
  } catch {
    return false;
  }
  if (target.length !== actual.length) return false;
  return timingSafeEqual(actual, target);
}

// The length rule lives in `policy.ts`, which carries no `server-only` marker,
// because the sign-up form has to state it and importing it from here dragged
// scrypt into the browser bundle.
