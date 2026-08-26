/**
 * Canonical role IDs, mirroring `ROLE_CATALOG` in
 * flightops-services/shared/flightops_shared/auth/roles.py.
 *
 * WHY THIS FILE EXISTS
 *
 * Role gating in this app was written with bare string literals, and a
 * role name that does not exist fails silently — `set.has("typo")` is
 * just false, so the gate closes and nobody sees an error. The home
 * page's Active Alerts panel was gated on "super_admin",
 * "director_of_operations" and "admin", none of which are real roles.
 * The effect: an Exec Admin, the most privileged role there is, did not
 * see the alerts panel they are meant to see. Chief Pilot, Dispatcher
 * and Safety Officer were in the same set spelled correctly, so the
 * feature half-worked and nothing looked broken.
 *
 * Typing the gates against this union turns that class of mistake into
 * a compile error.
 *
 * NOT the source of truth for anything the user picks. Settings → Users
 * renders the role list served by /auth/settings/users, so adding a role
 * backend-side shows up there without touching this file. This exists so
 * that code which HARDCODES a role — a page gate, a permission check —
 * cannot hardcode one that does not exist.
 */

export const ROLES = [
  "exec_admin",
  "dispatcher",
  "reservations_agent",
  "chief_pilot",
  "maintenance",
  "ground_ops",
  "safety_officer",
  "pilot",
  "crew_member",
] as const;

export type Role = (typeof ROLES)[number];

const ROLE_SET: ReadonlySet<string> = new Set(ROLES);

/** Narrow an arbitrary string — a JWT claim, an API field — to a known
 *  role. Unknown values are dropped rather than trusted. */
export function isRole(value: string): value is Role {
  return ROLE_SET.has(value);
}

/** Build a gate from role IDs. Typed, so a name that is not a real role
 *  fails to compile instead of quietly never matching. */
export function roleGate(...roles: Role[]): ReadonlySet<Role> {
  return new Set(roles);
}

/** Does this caller hold any of the gate's roles? */
export function hasAnyRole(
  callerRoles: readonly string[],
  gate: ReadonlySet<Role>,
): boolean {
  return callerRoles.some((r) => isRole(r) && gate.has(r));
}
