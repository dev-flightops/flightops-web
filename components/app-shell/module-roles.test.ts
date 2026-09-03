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
    for (const closed of [
      "maintenance",
      "ground-ops",
      "hr",
      "admin",
      "settings",
      "crew",
    ]) {
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

  it.each(ROLES)(
    "%s sees at least one module in each of its departments",
    (role) => {
      for (const dept of visibleDepartments([role])) {
        expect(
          visibleModules(dept, [role]).length,
          `${role} sees ${dept.id} but none of its modules`,
        ).toBeGreaterThan(0);
      }
    },
  );
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
  // Widened in M4 from exec_admin alone. The operator's GOM puts full
  // system administration — adding and archiving users and aircraft — at
  // Level 1, and names the Director of Operations there. It also names
  // the Chief Pilot and Director of Maintenance at that level, which we
  // deliberately do not follow: that is one operator's own policy rather
  // than a regulation, and the narrower default is the safer one to ship.
  // An operator wanting the GOM's exact tiers grants exec_admin alongside.
  const ADMIN_DEPARTMENTS = ["hr", "settings"] as const;
  const MAY_SEE_ADMIN: readonly Role[] = [
    "exec_admin",
    "director_of_operations",
  ];

  it("keeps HR and settings to exec_admin and the Director of Operations", () => {
    for (const role of ROLES.filter((r) => !MAY_SEE_ADMIN.includes(r))) {
      for (const dept of ADMIN_DEPARTMENTS) {
        expect(idsFor([role]), `${role} should not see ${dept}`).not.toContain(
          dept,
        );
      }
    }
  });

  it("does admit both of the roles that may", () => {
    // The negative test above passes trivially if the allow-list is
    // wrong in the other direction, so assert the positive too.
    for (const role of MAY_SEE_ADMIN) {
      for (const dept of ADMIN_DEPARTMENTS) {
        expect(idsFor([role]), `${role} should see ${dept}`).toContain(dept);
      }
    }
  });

  it("does not give the Chief Pilot or DOM company settings", () => {
    // Named explicitly because the GOM does put them at Level 1, so a
    // future reader comparing the two will wonder whether this is an
    // oversight. It is a choice.
    expect(idsFor(["chief_pilot"])).not.toContain("settings");
    expect(idsFor(["director_of_maintenance"])).not.toContain("settings");
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
    const known = new Set(
      DEPARTMENTS.flatMap((d) => d.children.map((m) => m.id)),
    );
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

describe("the M4 post-holder roles", () => {
  // A role absent from this matrix is admitted almost nowhere: _permits
  // opens only when one of the caller's roles is named. Adding the three
  // to lib/roles.ts without matrix entries would have given a Director
  // of Operations less of the app than a dispatcher.
  //
  // The existing "every role gets a usable nav" checks cannot catch that,
  // because academy and safety are [...ROLES] — every role sees those two
  // for free, so "at least one department" is satisfied by a role that
  // sees nothing else. Hence the invariant below.
  const UNIVERSAL = ["academy", "safety"];

  it.each(ROLES)("%s sees a department beyond the universal two", (role) => {
    const beyond = idsFor([role]).filter((id) => !UNIVERSAL.includes(id));
    expect(
      beyond.length,
      `${role} sees only ${UNIVERSAL.join(" and ")} — it is missing from the matrix`,
    ).toBeGreaterThan(0);
  });

  describe("director_of_operations", () => {
    it("sees everything a dispatcher sees", () => {
      // Accountable for the operation, so being shown less than the
      // people reporting to them is the failure mode worth pinning.
      const dispatcher = idsFor(["dispatcher"]);
      const director = idsFor(["director_of_operations"]);
      for (const dept of dispatcher) {
        expect(
          director,
          `DO cannot see ${dept} but a dispatcher can`,
        ).toContain(dept);
      }
    });

    it("sees everything a chief pilot sees", () => {
      const chief = idsFor(["chief_pilot"]);
      const director = idsFor(["director_of_operations"]);
      for (const dept of chief) {
        expect(
          director,
          `DO cannot see ${dept} but a chief pilot can`,
        ).toContain(dept);
      }
    });

    it("is named in every operations module, not just the department", () => {
      // Operations is listed exhaustively, so department membership alone
      // grants nothing.
      const ops = deptById("operations");
      const visible = visibleModules(ops, ["director_of_operations"]).map(
        (m) => m.id,
      );
      expect(visible.sort()).toEqual(ops.children.map((m) => m.id).sort());
    });
  });

  describe("director_of_maintenance", () => {
    it("sees maintenance and ground equipment", () => {
      const ids = idsFor(["director_of_maintenance"]);
      expect(ids).toContain("maintenance");
      expect(ids).toContain("ground-ops");
    });

    it("does not get crew records or reservations", () => {
      const ids = idsFor(["director_of_maintenance"]);
      expect(ids).not.toContain("crew");
      expect(ids).not.toContain("reservations");
    });

    it("gets reporting, which the GOM puts at Level 2", () => {
      expect(idsFor(["director_of_maintenance"])).toContain("admin");
    });
  });

  describe("check_airman", () => {
    it("sees the records a check needs", () => {
      const ops = deptById("operations");
      const visible = visibleModules(ops, ["check_airman"]).map((m) => m.id);
      for (const mod of [
        "crew",
        "roster",
        "currency",
        "flight-log",
        "pilot-history",
      ]) {
        expect(visible, `check airman cannot reach ${mod}`).toContain(mod);
      }
    });

    it("has no release authority", () => {
      // Checking a pilot and dispatching a flight are different jobs.
      // This is the assertion that stops the role drifting into a second
      // chief_pilot as modules get added.
      const ops = deptById("operations");
      const visible = visibleModules(ops, ["check_airman"]).map((m) => m.id);
      expect(visible).not.toContain("dispatch");
      expect(visible).not.toContain("schedule");
    });

    it("does not get company settings", () => {
      expect(idsFor(["check_airman"])).not.toContain("settings");
    });
  });
});
