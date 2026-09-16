import { describe, expect, it } from "vitest";

import { BOARD_ROLES, MANAGE_ROLES, TRIAGE_ROLES } from "./safety-roles";

/**
 * These gates mirror role tuples in flightops-services. The repos are
 * separate, so nothing can import the real thing — which is exactly how
 * they drifted: services#187 widened the API gates and the UI's copies
 * were left behind on three pages.
 *
 * So the membership is pinned here, naming the file to read. The point
 * is not that these values are self-evidently right; it is that
 * changing one has to be deliberate, and the reviewer is told where the
 * other half lives.
 */

describe("triage gate", () => {
  // services/safety/app/routes/hazards.py    TRIAGE_ROLES
  // services/safety/app/routes/incidents.py  TRIAGE_ROLES
  it("matches the API's TRIAGE_ROLES", () => {
    expect([...TRIAGE_ROLES].sort()).toEqual([
      "chief_pilot",
      "director_of_operations",
      "exec_admin",
      "safety_officer",
    ]);
  });

  it("admits the Director of Operations", () => {
    // The regression. A DO could open the hazard list as a triager and
    // find the controls gone on the report itself.
    expect(TRIAGE_ROLES.has("director_of_operations")).toBe(true);
  });
});

describe("CAPA board gate", () => {
  // services/safety/app/routes/corrective_actions.py BOARD_ROLES
  it("matches the API's BOARD_ROLES", () => {
    expect([...BOARD_ROLES].sort()).toEqual([
      "chief_pilot",
      "director_of_operations",
      "exec_admin",
      "safety_officer",
    ]);
  });
});

describe("CAPA manage gate", () => {
  // services/safety/app/routes/corrective_actions.py MANAGE_ROLES
  it("matches the API's MANAGE_ROLES", () => {
    expect([...MANAGE_ROLES].sort()).toEqual([
      "exec_admin",
      "safety_officer",
    ]);
  });

  it("stays narrower than the board gate", () => {
    // Reading the board and owning the corrective-action programme are
    // different jobs. If these two ever become equal, one of them was
    // widened by accident — a chief pilot silently gaining the power to
    // close CAPAs is not a cosmetic change.
    expect(MANAGE_ROLES.size).toBeLessThan(BOARD_ROLES.size);
    for (const r of MANAGE_ROLES) expect(BOARD_ROLES.has(r)).toBe(true);
  });

  it("does not admit a chief pilot or a DO", () => {
    expect(MANAGE_ROLES.has("chief_pilot")).toBe(false);
    expect(MANAGE_ROLES.has("director_of_operations")).toBe(false);
  });
});
