import { isRole } from "@/lib/roles";

/**
 * Staff and external logins, and where each may go.
 *
 * A login with none of the platform's roles is not the operator's
 * staff. Today that is one of two people:
 *
 *   - a charter customer — the portal matches the login to a Customer
 *     record by email (there is no customer role; legacy's
 *     `charter_client` could read its own charters and nothing else);
 *   - a fuel supplier's rep — a User linked to a FuelSupplier, who
 *     works the supplier inbox.
 *
 * The app used to treat an empty role list as "roles failed to load"
 * and show everything, so a customer got the staff screens with the
 * operator's internal alerts in the bell. The services now refuse such
 * a login everywhere but its own surfaces
 * (flightops_shared.tenancy.middleware); this is the web half.
 */

/** Pages an external login may open. */
const EXTERNAL_PREFIXES = ["/portal", "/fuel/supplier"] as const;

/** Pages outside Auth.js entirely: the cross-tenant fuel supplier
 *  portal checks its own `fuel_supplier_session` cookie, and the platform
 *  administrators' pages (#63) their `platform_session` one. */
const OWN_AUTH_PREFIXES = ["/fuel-supplier", "/platform"] as const;

/** Where an external login lands. */
export const EXTERNAL_HOME = "/portal";
/** Where staff land. */
export const STAFF_HOME = "/home/";

const under = (path: string, prefix: string) =>
  path === prefix || path.startsWith(`${prefix}/`);

/** True when a session holds at least one of the platform's roles. */
export function isStaffSession(
  roles: readonly string[] | null | undefined,
): boolean {
  return (roles ?? []).some(isRole);
}

export function isExternalPath(path: string): boolean {
  return EXTERNAL_PREFIXES.some((p) => under(path, p));
}

/**
 * Where the auth proxy should send a request instead, or null to let it
 * through.
 */
export function guardRedirect({
  loggedIn,
  roles,
  path,
  isServerAction,
}: {
  loggedIn: boolean;
  roles: readonly string[] | null | undefined;
  path: string;
  /** Server Actions POST to their host page; see proxy.ts. */
  isServerAction: boolean;
}): string | null {
  if (OWN_AUTH_PREFIXES.some((p) => under(path, p))) return null;

  const isLoginPage = path === "/login" || path === "/login/";
  if (!loggedIn) {
    return isLoginPage || isServerAction ? null : "/login";
  }

  const staff = isStaffSession(roles);
  if (isLoginPage) return staff ? STAFF_HOME : EXTERNAL_HOME;
  if (!staff && !isExternalPath(path)) return EXTERNAL_HOME;
  return null;
}
