import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A "use server" file exports its actions one declaration at a time,
 * never through an export clause (#67).
 *
 * The fuel order page's actions ended with
 * `export type { ActionState as FuelOrderActionState };`. TypeScript
 * erases that, and the type checker, the linter and every unit test were
 * content. Next's server-action compiler is not: it registers each name
 * in an export clause as an action, so loading the module referenced
 * `ActionState` at run time and threw. Every Confirm, Mark fueled and
 * Cancel on the page answered "Something went wrong", and the equipment
 * page, written the same way, failed on every action too. Nothing short
 * of running an action in a real build showed it.
 *
 * `export type X = ...` and `export async function ...` are fine; a
 * clause (`export { ... }`, `export type { ... }`, `export * from`) is
 * what this refuses.
 */

const ROOTS = ["app", "components", "lib"];
const CLAUSE = /^\s*export\s+(type\s+)?\{|^\s*export\s+\*/m;

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(p);
  }
  return out;
}

const SERVER_FILES = ROOTS.flatMap((root) => walk(root)).filter((file) =>
  /^\s*["']use server["']/.test(stripComments(readFileSync(file, "utf8"))),
);

describe('"use server" files', () => {
  it("are found", () => {
    expect(SERVER_FILES.length).toBeGreaterThan(50);
  });

  it("export nothing through an export clause", () => {
    const offenders = SERVER_FILES.filter((file) =>
      CLAUSE.test(stripComments(readFileSync(file, "utf8"))),
    );
    expect(offenders).toEqual([]);
  });
});
