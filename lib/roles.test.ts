import { describe, expect, it } from "vitest";

import { hasAnyRole, isRole, ROLES, roleGate } from "./roles";

describe("roles", () => {
  it("matches the backend catalogue exactly", () => {
    // Mirrors ROLE_CATALOG in
    // flightops-services/shared/flightops_shared/auth/roles.py. If the
    // backend adds or renames a role, this fails and someone has to
    // decide whether the gates in this app should change too — rather
    // than a gate quietly never matching again.
    expect([...ROLES].sort()).toEqual(
      [
        "chief_pilot",
        "crew_member",
        "dispatcher",
        "exec_admin",
        "ground_ops",
        "maintenance",
        "pilot",
        "reservations_agent",
        "safety_officer",
      ].sort(),
    );
  });

  it("rejects the names that actually shipped broken", () => {
    // The home page gated Active Alerts on these three. None is a role,
    // so the check silently failed for exec_admin — the most privileged
    // account on the system — while the correctly-spelled roles beside
    // them passed. Half-working is why nobody noticed.
    expect(isRole("super_admin")).toBe(false);
    expect(isRole("director_of_operations")).toBe(false);
    expect(isRole("admin")).toBe(false);
    expect(isRole("exec_admin")).toBe(true);
  });

  it("drops unknown roles rather than trusting them", () => {
    // Caller roles arrive from a JWT claim. Anything unrecognised is
    // not a role we grant anything for.
    const gate = roleGate("exec_admin");
    expect(hasAnyRole(["exec_admin"], gate)).toBe(true);
    expect(hasAnyRole(["super_admin", "wheel", ""], gate)).toBe(false);
  });

  it("matches when the caller holds any one of several roles", () => {
    const gate = roleGate("chief_pilot", "safety_officer");
    expect(hasAnyRole(["pilot", "safety_officer"], gate)).toBe(true);
    expect(hasAnyRole(["pilot"], gate)).toBe(false);
    expect(hasAnyRole([], gate)).toBe(false);
  });
});
