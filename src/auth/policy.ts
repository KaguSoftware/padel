/**
 * What the product will accept as a password — and nothing that touches one.
 *
 * Deliberately separate from `password.ts`, which is `server-only` because it
 * carries the hashing. The sign-up form needs to state the rule and set a
 * `minLength`, and importing the rule from the crypto module pulled scrypt into
 * the browser bundle — which the `server-only` marker caught, exactly as it is
 * meant to. The rule is not a secret; the hashing is.
 *
 * Length is the only rule. Composition rules ("one capital, one symbol") push
 * people towards `Password1!` and towards writing it on a note at the front
 * desk; length is what actually costs an attacker anything.
 */

export const MIN_PASSWORD_LENGTH = 10;

export function passwordProblem(plaintext: string): string | null {
  if (plaintext.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}
