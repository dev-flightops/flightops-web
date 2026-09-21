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
 *
 * WHY IT NOW READS STATIC HREFS TOO
 *
 * It used to skip them, on the stated grounds that "a static href is
 * already covered by the catalogue guards". It is not. Those guards
 * check hrefs that live in a catalogue — HOME_MODULES, DEPARTMENTS,
 * MAINTENANCE_ACTIONS. A plain string written inline in JSX is in no
 * catalogue and was therefore in no guard, and four dead ones were
 * sitting in the app:
 *
 *   /manifest offered "+ New Flight" and "Schedule First Flight", both
 *   to /dispatch/new. No such page — but /dispatch/[flightId] catches
 *   it, treats "new" as a flight id, finds nothing and bounces to the
 *   board with ?flight=new. The primary call to action on the page did
 *   not 404; it just quietly did nothing useful. Flight creation is at
 *   /flight-following/new.
 *
 *   The chief pilot dashboard linked "crew records →" to /crew and
 *   "all →" to /recognition/pilots. Both 404. /crew has never existed
 *   in this app; legacy has it, which is how it got written down.
 *
 *   Settings -> FRAT pointed "the preflight sequence" at
 *   /flight-crew/preflight, which is only ever [flightId]-scoped.
 *
 * Two things the resolver had to learn before this could be switched
 * on, both of which produced false alarms on the first run:
 *
 *   Route groups. /login lives in app/(auth), not app/(app), so it
 *   read as missing. Every app/(group) is now searched.
 *
 *   Literal segments that a [param] directory catches. /dispatch/new
 *   resolves at runtime via [flightId]; reporting it as a missing
 *   route would be wrong about the mechanism even when the link is
 *   wrong about the destination. A literal segment now falls back to a
 *   dynamic sibling, so what this test reports is genuinely absent.
 */

const APP = "app/(app)";
const API = "app/api";

/** Every route group under app/, so a page in (auth) or (fuel-supplier)
 *  resolves as readily as one in (app). */
function routeRoots(): string[] {
  const groups = readdirSync("app", { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith("("))
    .map((e) => join("app", e.name));
  return [...groups, "app"];
}

/**
 * Hrefs that deliberately point at nothing yet. href -> why.
 *
 * A SectionLink has to carry an href even when its status dims it to a
 * non-clickable div, so the planned target is written down before the
 * page exists. That is the href's job here, not a dead link.
 */
const PLANNED_TARGETS: Record<string, string> = {
  "/ramper/messages": "ground-ops SectionLink, status m3 — renders as a dimmed div, never a Link.",
};

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

/** Both `href="..."` and JSX's `href={`...`}`. */
const HREF_TEMPLATE = /href[=:]\s*\{?\s*[`]([^`]*)[`]/g;

/** The same, for a plain quoted string. */
const HREF_STATIC = /href[=:]\s*\{?\s*["']([^"']*)["']/g;

/**
 * Comments go before matching. The module catalogue's own "adding a new
 * module" instructions include `href: "/your/route"` as an example, and
 * a scanner that reads prose as code reports the documentation.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function collectTemplates(): Map<string, string> {
  const found = new Map<string, string>();
  for (const dir of [APP, "components", "lib"]) {
    for (const file of sourceFiles(dir)) {
      const src = stripComments(readFileSync(file, "utf8"));
      for (const re of [HREF_TEMPLATE, HREF_STATIC]) {
        for (const match of src.matchAll(re)) {
          const raw = match[1];
          if (!raw.startsWith("/")) continue;
          if (raw in PLANNED_TARGETS) continue;
          if (!found.has(raw)) found.set(raw, file);
        }
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
function resolvesUnder(root: string, segments: string[]): boolean {
  let dir = root;
  for (const segment of segments) {
    const dynamic = () =>
      existsSync(dir) ? readdirSync(dir).filter((n) => n.startsWith("[")) : [];

    if (segment.includes("${")) {
      const dyn = dynamic();
      if (dyn.length === 0) return false;
      dir = join(dir, dyn[0]);
      continue;
    }

    const literal = join(dir, segment);
    if (existsSync(literal)) {
      dir = literal;
      continue;
    }
    // A literal the router hands to a [param] page — /dispatch/new is
    // served by /dispatch/[flightId]. The route resolves; whether it
    // resolves to anything the reader wanted is a separate question.
    const dyn = dynamic();
    if (dyn.length === 0) return false;
    dir = join(dir, dyn[0]);
  }
  return (
    existsSync(join(dir, "page.tsx")) || existsSync(join(dir, "route.ts"))
  );
}

function routeExists(template: string): boolean {
  const path = template.split(/[?#]/)[0];
  const segments = path.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  if (segments.length === 0) return false;
  if (segments[0] === "api") return resolvesUnder(API, segments.slice(1));
  return routeRoots().some((root) => resolvesUnder(root, segments));
}

describe("dynamic link targets", () => {
  it("finds the hrefs at all", () => {
    // Guards the guard. The first version of this matched 5 hrefs and
    // reported everything clean; the template-only version matched 72.
    // Reading static hrefs too brings it to 212, so the floor moves
    // with it — a floor of 40 would now be satisfied by a scan that had
    // stopped seeing four fifths of the app.
    expect(collectTemplates().size).toBeGreaterThanOrEqual(180);
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
