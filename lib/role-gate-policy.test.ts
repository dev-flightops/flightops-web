import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

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
