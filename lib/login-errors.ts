/**
 * What a failed sign-in says (#16).
 *
 * The auth service locks an email for a while after repeated wrong
 * passwords and answers 429 with Retry-After. Until #16 every failure
 * read "Invalid email or password", so someone locked out would keep
 * typing the right password into a door that would not open. Legacy
 * said how long to wait; so does this.
 *
 * A lock says nothing about which addresses exist: the service locks
 * any address the same way, and this text is the same for all of them.
 */

/** Auth.js carries a CredentialsSignin's `code` back to the form. */
export const TOO_MANY_ATTEMPTS = "too_many_attempts";

const INVALID = "Invalid email or password.";

/** Whole minutes from a Retry-After (seconds); the service's 15 when
 *  the header is missing or unreadable. */
export function lockoutMinutes(retryAfter: string | null | undefined): number {
  const seconds = Number(retryAfter);
  if (!retryAfter || !Number.isFinite(seconds) || seconds <= 0) return 15;
  return Math.max(1, Math.ceil(seconds / 60));
}

export function tooManyAttemptsCode(minutes: number): string {
  return `${TOO_MANY_ATTEMPTS}:${minutes}`;
}

export function tooManyAttemptsMessage(minutes: number): string {
  return `Too many failed sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

/** The form's message for an Auth.js sign-in result's `code`. */
export function loginErrorMessage(code: string | null | undefined): string {
  const match = /^too_many_attempts:(\d+)$/.exec(code ?? "");
  return match ? tooManyAttemptsMessage(Number(match[1])) : INVALID;
}
