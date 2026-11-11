import type { OperationalAlert } from "@/lib/dashboards/operational-snapshot";
import { CHECKIN_ROLES, hasAnyRole, roleGate, type Role } from "@/lib/roles";

/**
 * Who each of the operation's alerts is for (LOG-42, 10/23: "Can the
 * notifications be specific to whatever role is logged in? ... I'm logged
 * in as a Ramp Crew and the notifications should be ramp specific"). Each
 * goes to the roles that act on it. Dispatch and the operation's leaders
 * see them all, as before. A person's own alerts (personal-alerts.ts) are
 * already worked out for that person.
 */

/** Dispatch, the Chief Pilot, the DO and the Exec Admin: every alert. */
export const SEES_EVERY_ALERT = roleGate("dispatcher", "chief_pilot", "director_of_operations", "exec_admin");

const MAINTENANCE = roleGate("maintenance", "director_of_maintenance");
const NO_ONE_ELSE: ReadonlySet<Role> = new Set();

const AUDIENCE: Record<OperationalAlert["category"], ReadonlySet<Role> | "own"> = {
  aircraft_grounded: MAINTENANCE,
  mel_expiring: MAINTENANCE,
  safety_report_new: roleGate("safety_officer"),
  // "let the Hooper agent/dispatch know" (#120): whoever checks passengers in.
  seat_open: CHECKIN_ROLES,
  flight_overdue: NO_ONE_ELSE,
  departure_flagged: NO_ONE_ELSE,
  duty_over_limit: NO_ONE_ELSE,
  frat_over_limits: NO_ONE_ELSE,
  squawk_new: "own",
  load_complete: "own",
  handoff: "own",
  departure_soon: "own",
  fuel_order: "own",
};

/** Is the alert for someone with these roles? A session that came without
 *  its roles sees them all, as the top bar's links fail open on one. */
export function alertIsFor(alert: Pick<OperationalAlert, "category">, roles: readonly string[]): boolean {
  const audience = AUDIENCE[alert.category];
  if (audience === "own" || roles.length === 0) return true;
  return hasAnyRole(roles, SEES_EVERY_ALERT) || hasAnyRole(roles, audience);
}
