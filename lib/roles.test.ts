import { describe, expect, it } from "vitest";

import {
  AIRWORTHINESS_WRITERS,
  CURRENCY_SIGNOFF,
  FLIGHT_LOG_ADMINS,
  GSE_WRITERS,
  hasAnyRole,
  isRole,
  OVERRIDE_AUTHORITY,
  ROLES,
  roleGate,
  STATION_ADMINS,
  VILLAGE_WX_REPORTERS,
} from "./roles";

describe("roles", () => {
  it("matches the backend catalogue exactly", () => {
    // Mirrors ROLE_CATALOG in
    // flightops-services/shared/flightops_shared/auth/roles.py. If the
    // backend adds or renames a role, this fails and someone has to
    // decide whether the gates in this app should change too — rather
    // than a gate quietly never matching again.
    expect([...ROLES].sort()).toEqual(
      [
        "check_airman",
        "chief_pilot",
        "crew_member",
        "director_of_maintenance",
        "director_of_operations",
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

  it("still rejects the invented names", () => {
    // The home page gated Active Alerts on "super_admin",
    // "director_of_operations" and "admin". None was a role, so the
    // check silently failed for exec_admin — the most privileged account
    // on the system — while the correctly-spelled roles beside them
    // passed. Half-working is why nobody noticed.
    expect(isRole("super_admin")).toBe(false);
    expect(isRole("admin")).toBe(false);
    expect(isRole("exec_admin")).toBe(true);
  });

  it("has since made director_of_operations real", () => {
    // One of the three invented names turned out to describe something
    // the operator actually has. It was added for real in M4, along with
    // Director of Maintenance and Check Airman, from the access tiers in
    // the operator's GOM.
    //
    // Worth keeping as its own test rather than folding into the list
    // above: the gate that referenced this name was written before the
    // role existed, which is exactly the mistake the typed union was
    // introduced to prevent. It now exists, and every gate that admits a
    // chief pilot admits it too.
    expect(isRole("director_of_operations")).toBe(true);
    expect(isRole("director_of_maintenance")).toBe(true);
    expect(isRole("check_airman")).toBe(true);
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

describe("who may do what a release relies on (29 Sep)", () => {
  // These mirror flightops-services shared/flightops_shared/auth/roles.py,
  // which enforces them. A role added here and not there would show a
  // control the server refuses; one added there and not here would hide
  // one it allows. Change both together.
  const sorted = (gate: ReadonlySet<string>) => [...gate].sort();

  it("overrides: the operation's management", () => {
    expect(sorted(OVERRIDE_AUTHORITY)).toEqual([
      "chief_pilot",
      "director_of_operations",
      "exec_admin",
    ]);
  });

  it("completions: those who sign pilots off, not the pilot", () => {
    expect(sorted(CURRENCY_SIGNOFF)).toEqual([
      "check_airman",
      "chief_pilot",
      "director_of_operations",
      "exec_admin",
    ]);
  });

  it("MELs and squawks: maintenance", () => {
    expect(sorted(AIRWORTHINESS_WRITERS)).toEqual([
      "director_of_maintenance",
      "exec_admin",
      "maintenance",
    ]);
  });
});

describe("the ground and village sets (29 Sep)", () => {
  // Mirrors of shared/flightops_shared/auth/roles.py; change both.
  const sorted = (gate: ReadonlySet<string>) => [...gate].sort();

  it("stations: station staff and management", () => {
    expect(sorted(STATION_ADMINS)).toEqual(["director_of_operations", "exec_admin", "ground_ops"]);
  });

  it("ground equipment: station staff, the DOM and management", () => {
    expect(sorted(GSE_WRITERS)).toEqual([
      "director_of_maintenance",
      "director_of_operations",
      "exec_admin",
      "ground_ops",
    ]);
  });

  it("flight logs: the Chief Pilot, DO and Exec Admin correct others'", () => {
    expect(sorted(FLIGHT_LOG_ADMINS)).toEqual([
      "chief_pilot",
      "director_of_operations",
      "exec_admin",
    ]);
  });

  it("village weather: legacy's reporters", () => {
    expect(sorted(VILLAGE_WX_REPORTERS)).toEqual([
      "chief_pilot",
      "director_of_operations",
      "dispatcher",
      "exec_admin",
      "ground_ops",
      "pilot",
      "reservations_agent",
    ]);
  });
});
