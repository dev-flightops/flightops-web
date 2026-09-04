import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEPARTMENT_ROLES,
  MODULE_ROLES,
} from "@/components/app-shell/modules";
import { HOME_MODULE_ROLES } from "@/components/home/module-catalog";

import { ROLES } from "./roles";

/**
 * Policy: a Director of Operations is admitted wherever a Chief Pilot is.
 *
 * The mirror of `shared/tests/test_role_gate_policy.py` in the services
 * repo. Both exist for the same reason: the failure being guarded
 * against is an *omission*, and a test can only cover the gate someone
 * remembered to write a test for.
 *
 * That is not hypothetical here. Adding the post-holder roles took three
 * goes. The catalogue landed without the admin_access rows, so the
 * Permissions toggle 404'd. The page gates landed without the API gates,
 * so a Director of Operations could open a page and be refused by it.
 * And the page-gate sweep itself missed `academy/studio/new` because it
 * worked from a hand-written list of files.
 *
 * This scans instead of listing. A new gate that admits a chief pilot
 * and forgets the DO fails here without anyone having to remember.
 */

const GATE = /roleGate\(([^)]*)\)/gs;
const ROLE_LITERAL = /"([a-z_]+)"/g;

interface Gate {
  file: string;
  roles: string[];
}

/**
 * Walked by hand rather than globbed. `node:fs` globSync is Node 22 but
 * absent from the @types/node this repo pins, and fast-glob is only
 * present transitively via eslint-config-next and tailwindcss — a
 * dependency bump could take it away and break this test for a reason
 * having nothing to do with role gates.
 */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") sourceFiles(path, out);
    } else if (
      /\.tsx?$/.test(entry.name) &&
      !entry.name.includes(".test.") &&
      entry.name !== "roles.ts"
    ) {
      out.push(path);
    }
  }
  return out;
}

function collectGates(): Gate[] {
  // Source files only — test files gate on made-up roles on purpose.
  const files = ["app", "components", "lib"].flatMap((d) => sourceFiles(d));

  const gates: Gate[] = [];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const match of src.matchAll(GATE)) {
      const roles = [...match[1].matchAll(ROLE_LITERAL)].map((m) => m[1]);
      if (roles.length > 0) gates.push({ file, roles });
    }
  }
  return gates;
}

describe("role gate policy", () => {
  it("finds the gates at all", () => {
    // Guards the guard. A pattern that matches nothing makes every
    // assertion below vacuously true — which is exactly how the first
    // version of the services-side scan reported green while checking
    // one gate in five.
    expect(collectGates().length).toBeGreaterThanOrEqual(8);
  });

  it("only gates on roles that exist", () => {
    // A misspelled role closes the gate silently: the set simply never
    // matches. This is the incident lib/roles.ts was written after.
    for (const { file, roles } of collectGates()) {
      const unknown = roles.filter((r) => !(ROLES as readonly string[]).includes(r));
      expect(unknown, `${file} gates on roles that do not exist`).toEqual([]);
    }
  });

  it("admits the Director of Operations wherever it admits a Chief Pilot", () => {
    const offenders = collectGates()
      .filter(
        (g) =>
          g.roles.includes("chief_pilot") &&
          !g.roles.includes("director_of_operations"),
      )
      .map((g) => `${g.file}: ${JSON.stringify(g.roles)}`);

    expect(
      offenders,
      "these gates admit a chief pilot but not a Director of Operations, who outranks them",
    ).toEqual([]);
  });
});

/**
 * The same policy, over the role *matrices* rather than the gate calls.
 *
 * This section exists because the scan above missed a real bug. It looks
 * for `roleGate(...)` calls, and the home page does not gate that way —
 * it filters its department tiles through HOME_MODULE_ROLES, a plain
 * object. So when the post-holder roles were added to the nav matrix and
 * to every page gate, the home tiles were left behind, and a Director of
 * Operations logged in to a dashboard showing two departments out of
 * fourteen. Every test passed.
 *
 * There are three matrices. The count is asserted, so a fourth cannot be
 * added without this failing and someone deciding whether the policy
 * applies to it.
 */

const MATRICES: Record<string, Record<string, readonly string[]>> = {
  DEPARTMENT_ROLES: DEPARTMENT_ROLES as Record<string, readonly string[]>,
  MODULE_ROLES: MODULE_ROLES as Record<string, readonly string[]>,
  HOME_MODULE_ROLES: HOME_MODULE_ROLES as Record<string, readonly string[]>,
};

// Entries where a chief pilot is admitted and a Director of Operations
// deliberately is not. Empty; anything added needs a reason.
const MATRIX_EXCEPTIONS = new Set<string>();

describe("role matrix policy", () => {
  it("knows about every matrix in the app", () => {
    // Guards the guard, and this is the one that would have caught the
    // home-tile bug: a matrix nobody enumerated is a matrix nobody
    // checks. Bump this deliberately when adding one.
    const declared = Object.keys(MATRICES).length;
    expect(
      declared,
      "a role matrix was added or removed — decide whether the policy applies to it",
    ).toBe(3);
  });

  it("only ever names roles that exist", () => {
    for (const [matrix, entries] of Object.entries(MATRICES)) {
      for (const [key, roles] of Object.entries(entries)) {
        const unknown = roles.filter(
          (r) => !(ROLES as readonly string[]).includes(r),
        );
        expect(unknown, `${matrix}.${key} names roles that do not exist`).toEqual(
          [],
        );
      }
    }
  });

  it("admits the Director of Operations wherever it admits a Chief Pilot", () => {
    const offenders: string[] = [];
    for (const [matrix, entries] of Object.entries(MATRICES)) {
      for (const [key, roles] of Object.entries(entries)) {
        if (MATRIX_EXCEPTIONS.has(`${matrix}.${key}`)) continue;
        if (
          roles.includes("chief_pilot") &&
          !roles.includes("director_of_operations")
        ) {
          offenders.push(`${matrix}.${key}: ${JSON.stringify(roles)}`);
        }
      }
    }
    expect(
      offenders,
      "these entries admit a chief pilot but not a Director of Operations",
    ).toEqual([]);
  });

  it("admits the Director of Maintenance wherever it admits maintenance", () => {
    const offenders: string[] = [];
    for (const [matrix, entries] of Object.entries(MATRICES)) {
      for (const [key, roles] of Object.entries(entries)) {
        if (MATRIX_EXCEPTIONS.has(`${matrix}.${key}`)) continue;
        if (
          roles.includes("maintenance") &&
          !roles.includes("director_of_maintenance")
        ) {
          offenders.push(`${matrix}.${key}: ${JSON.stringify(roles)}`);
        }
      }
    }
    expect(
      offenders,
      "these entries admit maintenance but not the Director of Maintenance",
    ).toEqual([]);
  });
});
