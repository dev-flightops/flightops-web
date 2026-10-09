import { readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { LEGACY_REDIRECTS, legacyRedirect } from "./legacy-redirects";
import { LEGACY_NOT_PAGES, LEGACY_PAGES } from "./legacy-routes.fixture";

type Route = { path: string; page: boolean };

/** Every FlightOps route under app/, pages and route handlers: route
 *  groups dropped, dynamic segments kept as [name]. */
function flightOpsRoutes(dir = "app", path = ""): Route[] {
  const found: Route[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && (entry.name === "page.tsx" || entry.name === "route.ts")) {
      found.push({ path: path || "/", page: entry.name === "page.tsx" });
    } else if (entry.isDirectory() && !/^[_@]/.test(entry.name)) {
      const segment = /^\(.*\)$/.test(entry.name) ? "" : `/${entry.name}`;
      found.push(...flightOpsRoutes(join(dir, entry.name), path + segment));
    }
  }
  return found;
}

const ROUTES = flightOpsRoutes();
/** Where a redirect may land: a page at a fixed path. */
const FIXED_PAGES = new Set(
  ROUTES.filter((r) => r.page && !r.path.includes("[")).map((r) => r.path),
);

const UUID = "0b7f5a52-8c1e-4d2a-9f3b-6e4c2d1a7b90";
/** A FlightOps URL for a route: a UUID in every dynamic segment. */
const flightOpsUrl = (path: string) => path.replace(/\[\[?(\.\.\.)?\w+\]\]?/g, UUID);
/** True when a destination, less any query of its own, is a fixed page. */
const landsOnPage = (to: string) => FIXED_PAGES.has(to.split("?")[0]);
/** A legacy URL for a legacy route: 123 for an integer id, words otherwise. */
const legacyUrl = (path: string) =>
  path.replace(/:id\b/g, "123").replace(/:key\b/g, "abc").replace(/:path\b/g, "abc/def");

describe("legacyRedirect", () => {
  it("sends the issue's examples to their FlightOps lists", () => {
    expect(legacyRedirect("/manifest/flights/123")).toBe("/manifest");
    expect(legacyRedirect("/crew/members/45")).toBe("/compliance/roster");
  });

  it("reads an id as a legacy integer: a FlightOps UUID or a word is not one", () => {
    expect(legacyRedirect("/weather/42")).toBe("/weather");
    expect(legacyRedirect(`/weather/${UUID}`)).toBeNull();
    expect(legacyRedirect("/weather/new")).toBeNull();
    expect(legacyRedirect(`/manifest/flights/${UUID}`)).toBeNull();
  });

  it("takes legacy's trailing slash, and leaves the root alone", () => {
    expect(legacyRedirect("/following/")).toBe("/flight-following");
    expect(legacyRedirect("/dashboard/")).toBe("/dashboards");
    expect(legacyRedirect("/")).toBeNull();
  });

  it("matches a path parameter across segments", () => {
    expect(legacyRedirect("/recognition/profile/pilot/jane/doe")).toBe("/home");
  });
});

describe("the legacy map", () => {
  it("lands every legacy page on a FlightOps page", () => {
    const lost = LEGACY_PAGES.flatMap((page) => {
      const url = legacyUrl(page);
      const to = legacyRedirect(url);
      // No rule is right only where FlightOps serves the same path.
      return landsOnPage(to ?? url) ? [] : [`${page} -> ${to ?? "(no rule)"}`];
    });
    expect(lost).toEqual([]);
  });

  it("lands them the same way with legacy's trailing slash", () => {
    const differ = LEGACY_PAGES.filter(
      (page) => page !== "/" && legacyRedirect(`${legacyUrl(page)}/`) !== legacyRedirect(legacyUrl(page)),
    );
    expect(differ).toEqual([]);
  });

  it("never catches a FlightOps page or route handler", () => {
    expect(ROUTES.length).toBeGreaterThan(100);
    const caught = ROUTES.map((r) => flightOpsUrl(r.path)).filter(
      (url) => legacyRedirect(url) !== null || legacyRedirect(`${url}/`) !== null,
    );
    expect(caught).toEqual([]);
  });

  it("has no rule for the HTMX pieces or the embedded booking widget", () => {
    const sent = LEGACY_NOT_PAGES.filter((path) => legacyRedirect(legacyUrl(path)) !== null);
    expect(sent).toEqual([]);
  });

  it("has a legacy page behind every rule, and one rule per page", () => {
    const pages = new Set(LEGACY_PAGES);
    const from = LEGACY_REDIRECTS.map(([f]) => f);
    expect(from.filter((f) => !pages.has(f))).toEqual([]);
    expect(new Set(from).size).toBe(from.length);
  });

  it("writes rules legacy's way and lands them on fixed FlightOps pages", () => {
    const badFrom = LEGACY_REDIRECTS.filter(([f]) =>
      f
        .split("/")
        .slice(1)
        .some((s, i, all) =>
          s === ":path" ? i !== all.length - 1 : !/^([a-z0-9-]+|:id|:key)$/.test(s),
        ),
    );
    expect(badFrom).toEqual([]);
    expect(LEGACY_REDIRECTS.filter(([, to]) => !landsOnPage(to))).toEqual([]);
  });
});
