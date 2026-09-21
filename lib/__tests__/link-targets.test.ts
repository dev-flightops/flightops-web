import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Every template-literal `href` has to point at a route that exists.
 *
 * This is the third dead link found by hand in this app. The flight
 * board offered a "Docs" link on every row to
 * `/flight-following/{id}/docs`; spotlight search sent every flight
 * result to `/flight-following/{id}`; and the BI report linked
 * customers to `/reservations/customers/{id}`. None of those routes
 * exists. All three were ported faithfully from legacy, where they do.
 *
 * The existing guards could not see them. `module-status.test.ts`
 * checks catalogue entries, and `help/catalogue.test.ts` checks help
 * articles — both are lists of literal routes. A link built with a
 * template literal inside a component is in neither.
 *
 * WHY THE FIRST VERSION OF THIS SCAN FOUND ALMOST NOTHING
 *
 * Its pattern required a backtick straight after `href=`, which misses
 * JSX's `href={`…`}` — the common form. It found 5 templates instead
 * of 72 and reported everything clean. A scan that matches almost
 * nothing passes silently, which is the same failure the role-gate
 * guard had.
 */

const APP = "app/(app)";
const API = "app/api";

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") sourceFiles(path, out);
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.includes(".test.")) {
      out.push(path);
    }
  }
  return out;
}

/** Both `href="..."` and JSX's `href={`...`}`, template literals only —
 *  a static href is already covered by the catalogue guards. */
const HREF_TEMPLATE = /href[=:]\s*\{?\s*[`]([^`]*)[`]/g;

function collectTemplates(): Map<string, string> {
  const found = new Map<string, string>();
  for (const dir of [APP, "components", "lib"]) {
    for (const file of sourceFiles(dir)) {
      const src = readFileSync(file, "utf8");
      for (const match of src.matchAll(HREF_TEMPLATE)) {
        const raw = match[1];
        if (!raw.startsWith("/")) continue;
        if (!found.has(raw)) found.set(raw, file);
      }
    }
  }
  return found;
}

/**
 * Resolve a template against the route tree. A `${...}` segment stands
 * for a dynamic segment, so the directory must have a `[param]` child.
 * An API path resolves under app/api instead.
 */
function routeExists(template: string): boolean {
  const path = template.split(/[?#]/)[0];
  const segments = path.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  const api = segments[0] === "api";
  let dir = api ? API : APP;
  for (const segment of api ? segments.slice(1) : segments) {
    if (segment.includes("${")) {
      const dynamic = existsSync(dir)
        ? readdirSync(dir).filter((n) => n.startsWith("["))
        : [];
      if (dynamic.length === 0) return false;
      dir = join(dir, dynamic[0]);
    } else {
      const next = join(dir, segment);
      if (!existsSync(next)) return false;
      dir = next;
    }
  }
  return (
    existsSync(join(dir, "page.tsx")) || existsSync(join(dir, "route.ts"))
  );
}

describe("dynamic link targets", () => {
  it("finds the templates at all", () => {
    // Guards the guard. The first version of this matched 5 of them
    // and reported everything clean.
    expect(collectTemplates().size).toBeGreaterThanOrEqual(40);
  });

  it("never links a route that does not exist", () => {
    const broken = [...collectTemplates()]
      .filter(([template]) => !routeExists(template))
      .map(([template, file]) => `${template}  (${file})`);
    expect(broken, "links built from a template with no route behind them").toEqual(
      [],
    );
  });

  it("resolves a dynamic page route", () => {
    // Sanity-checks the resolver rather than trusting an empty result.
    expect(routeExists("/employees/${id}")).toBe(true);
    expect(routeExists("/documents/${d.id}")).toBe(true);
  });

  it("resolves an API route handler", () => {
    expect(routeExists("/api/documents/${id}/download")).toBe(true);
  });

  it("rejects a route with only a dynamic child and no index", () => {
    // The trap this class of bug lives in: /flight-following has a
    // page, but /flight-following/{id} has no route under it.
    expect(routeExists("/flight-following/${f.id}")).toBe(false);
  });

  it("rejects a path nothing owns", () => {
    expect(routeExists("/no-such-module/${id}")).toBe(false);
  });
});
