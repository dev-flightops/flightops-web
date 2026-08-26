import { describe, expect, it } from "vitest";

import { ROLES, type Role } from "@/lib/roles";

import {
  DEPARTMENT_ROLES,
  DEPARTMENTS,
  MODULE_ROLES,
  canSeeDepartment,
  visibleDepartments,
  visibleModules,
} from "./modules";

const deptById = (id: string) => {
  const d = DEPARTMENTS.find((x) => x.id === id);
  if (!d) throw new Error(`no department ${id}`);
  return d;
};

const idsFor = (roles: readonly string[]) =>
  visibleDepartments(roles).map((d) => d.id);

describe("the client's two examples", () => {
  // "Pilots don't need to see reservations."
  it("hides reservations from pilots and crew", () => {
    expect(idsFor(["pilot"])).not.toContain("reservations");
    expect(idsFor(["crew_member"])).not.toContain("reservations");
  });

  it("still shows reservations to the people who run it", () => {
    expect(idsFor(["dispatcher"])).toContain("reservations");
    expect(idsFor(["exec_admin"])).toContain("reservations");
  });

  it("keeps operations visible to dispatchers", () => {
    expect(idsFor(["dispatcher"])).toContain("operations");
  });
});

describe("reservations_agent — the second half of the request", () => {
  // "Reservations don't need to see flight ops." Previously unbuildable:
  // the nearest role was dispatcher, who needs flight ops. Now it has its
  // own role, and these tests are what "don't need to see flight ops"
  // actually means in the nav.
  const AGENT = ["reservations_agent"];

  it("sees reservations", () => {
    expect(idsFor(AGENT)).toContain("reservations");
  });

  it("sees every module inside reservations", () => {
    const dept = deptById("reservations");
    expect(visibleModules(dept, AGENT)).toHaveLength(dept.children.length);
  });

  it("gets Flight Following and nothing else from operations", () => {
    const ops = deptById("operations");
    const ids = visibleModules(ops, AGENT).map((m) => m.id);
    expect(ids).toEqual(["flight-following"]);
  });

  it("cannot reach the release desk, crew or currency", () => {
    const ops = deptById("operations");
    const ids = visibleModules(ops, AGENT).map((m) => m.id);
    for (const closed of [
      "dispatch",
      "schedule",
      "weather",
      "crew",
      "currency",
      "flight-log",
      "roster",
      "pilot-history",
      "ramp-ops",
      "eod",
    ]) {
      expect(ids, `agent can see ${closed}`).not.toContain(closed);
    }
  });

  it("sees no maintenance, ground ops, HR, admin or settings", () => {
    const ids = idsFor(AGENT);
    for (const closed of ["maintenance", "ground-ops", "hr", "admin", "settings", "crew"]) {
      expect(ids, `agent can see ${closed}`).not.toContain(closed);
    }
  });

  it("still gets safety and academy like everyone else", () => {
    expect(idsFor(AGENT)).toContain("safety");
    expect(idsFor(AGENT)).toContain("academy");
  });
});

describe("operations is exhaustively listed", () => {
  // Once reservations_agent joined the department for Flight Following
  // alone, any module without its own entry would have been handed to
  // them by inheritance. This makes that omission impossible.
  it("names every operations module in MODULE_ROLES", () => {
    for (const mod of deptById("operations").children) {
      expect(
        MODULE_ROLES[mod.id],
        `operations module ${mod.id} has no explicit roles`,
      ).toBeDefined();
    }
  });
});

describe("every role gets a usable nav", () => {
  it.each(ROLES)("%s sees at least one department", (role) => {
    expect(idsFor([role]).length).toBeGreaterThan(0);
  });

  it.each(ROLES)("%s sees at least one module in each of its departments", (role) => {
    for (const dept of visibleDepartments([role])) {
      expect(
        visibleModules(dept, [role]).length,
        `${role} sees ${dept.id} but none of its modules`,
      ).toBeGreaterThan(0);
    }
  });
});

describe("universal departments", () => {
  // Gating hazard reporting by job title is how near-misses go
  // unreported. This one is not a preference.
  it.each(ROLES)("safety stays visible to %s", (role) => {
    expect(idsFor([role])).toContain("safety");
  });

  it.each(ROLES)("academy stays visible to %s", (role) => {
    expect(idsFor([role])).toContain("academy");
  });
});

describe("exec_admin", () => {
  it("sees every department", () => {
    expect(idsFor(["exec_admin"]).sort()).toEqual(
      DEPARTMENTS.map((d) => d.id).sort(),
    );
  });

  it("sees every module", () => {
    for (const dept of DEPARTMENTS) {
      expect(visibleModules(dept, ["exec_admin"])).toHaveLength(
        dept.children.length,
      );
    }
  });
});

describe("restricted departments", () => {
  it("keeps HR and settings to exec_admin", () => {
    for (const role of ROLES.filter((r) => r !== "exec_admin")) {
      expect(idsFor([role])).not.toContain("hr");
      expect(idsFor([role])).not.toContain("settings");
    }
  });

  it("keeps maintenance away from pilots and reservations work", () => {
    expect(idsFor(["pilot"])).not.toContain("maintenance");
    expect(idsFor(["crew_member"])).not.toContain("maintenance");
  });

  it("gives ground ops its own department but not the release desk", () => {
    expect(idsFor(["ground_ops"])).toContain("ground-ops");
    const ops = deptById("operations");
    const moduleIds = visibleModules(ops, ["ground_ops"]).map((m) => m.id);
    // Ramp Ops and EOD are station work that happens to live under
    // Operations; releasing flights is not.
    expect(moduleIds).toContain("ramp-ops");
    expect(moduleIds).toContain("eod");
    expect(moduleIds).not.toContain("dispatch");
  });
});

describe("multiple roles", () => {
  it("unions rather than intersects", () => {
    const both = idsFor(["pilot", "dispatcher"]);
    expect(both).toContain("reservations"); // from dispatcher
    expect(both).toContain("crew"); // from pilot
  });
});

describe("degraded sessions fail open", () => {
  // A user whose roles failed to load should get a cluttered nav, not an
  // empty one. The backend still refuses anything they click, and
  // stranding someone with no navigation is the worse failure.
  it("shows everything when the role list is empty", () => {
    expect(idsFor([])).toEqual(DEPARTMENTS.map((d) => d.id));
    for (const dept of DEPARTMENTS) {
      expect(visibleModules(dept, [])).toHaveLength(dept.children.length);
      expect(canSeeDepartment(dept, [])).toBe(true);
    }
  });

  it("ignores unknown role strings rather than granting on them", () => {
    // An unrecognised role is not empty, so the matrix still applies.
    expect(idsFor(["not_a_real_role"])).not.toContain("hr");
  });
});

describe("the matrix itself", () => {
  it("only names roles that exist in the backend catalogue", () => {
    const known = new Set<string>(ROLES);
    for (const [dept, roles] of Object.entries(DEPARTMENT_ROLES)) {
      for (const r of roles ?? []) {
        expect(known.has(r), `${dept} names unknown role ${r}`).toBe(true);
      }
    }
    for (const [mod, roles] of Object.entries(MODULE_ROLES)) {
      for (const r of roles) {
        expect(known.has(r), `${mod} names unknown role ${r}`).toBe(true);
      }
    }
  });

  it("only names departments that exist", () => {
    const known = new Set(DEPARTMENTS.map((d) => d.id));
    for (const id of Object.keys(DEPARTMENT_ROLES)) {
      expect(known.has(id as never), `unknown department ${id}`).toBe(true);
    }
  });

  it("only names modules that exist", () => {
    const known = new Set(DEPARTMENTS.flatMap((d) => d.children.map((m) => m.id)));
    for (const id of Object.keys(MODULE_ROLES)) {
      expect(known.has(id), `unknown module ${id}`).toBe(true);
    }
  });

  it("never lists a module role outside its department's roles", () => {
    // A module cannot be more permissive than the department that
    // contains it — the user would never reach the nav row to see it.
    for (const dept of DEPARTMENTS) {
      const deptRoles = DEPARTMENT_ROLES[dept.id];
      if (!deptRoles) continue;
      for (const mod of dept.children) {
        const modRoles = MODULE_ROLES[mod.id] as readonly Role[] | undefined;
        if (!modRoles) continue;
        for (const r of modRoles) {
          expect(
            (deptRoles as readonly string[]).includes(r),
            `${mod.id} admits ${r} but ${dept.id} does not`,
          ).toBe(true);
        }
      }
    }
  });
});
