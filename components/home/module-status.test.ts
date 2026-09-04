import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DEPARTMENTS } from "@/components/app-shell/modules";

import { HOME_MODULES } from "./module-catalog";

/**
 * A module's `status` and the route it points at have to agree.
 *
 * Two ways they drift, and both shipped:
 *
 *   1. A module stays marked `m3` after its pages land, so the home page
 *      advertises "Soon" for something that works and renders it
 *      unclickable. HR and Records and Compliance were both in this
 *      state — /employees returns nineteen rows and the compliance board
 *      has been live since M3, and neither could be reached from home.
 *
 *   2. A module marked `live` points at a route with no page. The HR
 *      department's "Records" nav entry linked to /compliance, which has
 *      no index — only /compliance/crew-currency, /compliance/roster and
 *      a per-pilot profile. A live link to a 404.
 *
 * Neither is visible from the code: the status and the route live in
 * different files from the page they describe. Both were found by
 * looking at the running app, which is not a repeatable check.
 *
 * WHAT THIS CANNOT SEE
 *
 * Routes with dynamic segments, and any page that renders but then
 * notFound()s on its own. The existence of page.tsx is the floor, not
 * proof the page is useful.
 */

const APP_DIR = "app/(app)";

/** Does a concrete (non-dynamic) route have a page? */
function hasPage(href: string): boolean | null {
  if (!href.startsWith("/") || href.startsWith("/api") || href.includes("[")) {
    return null; // not statically checkable
  }
  const segments = href.replace(/^\/+|\/+$/g, "");
  if (!segments) return null;
  return existsSync(join(APP_DIR, segments, "page.tsx"));
}

interface Entry {
  where: string;
  id: string;
  href?: string;
  status?: string;
}

function allEntries(): Entry[] {
  const out: Entry[] = HOME_MODULES.map((m) => ({
    where: "HOME_MODULES",
    id: m.id,
    href: m.href,
    status: m.status,
  }));
  for (const dept of DEPARTMENTS) {
    for (const child of dept.children) {
      out.push({
        where: `DEPARTMENTS.${dept.id}`,
        id: child.id,
        href: child.href,
        status: child.status,
      });
    }
  }
  return out;
}

describe("module status matches what is actually built", () => {
  it("finds entries to check", () => {
    // Guards the guard: an empty catalogue passes everything below.
    expect(allEntries().length).toBeGreaterThanOrEqual(20);
  });

  it("never links a live module at a route with no page", () => {
    const broken = allEntries()
      .filter((e) => e.status === "live" && e.href && hasPage(e.href) === false)
      .map((e) => `${e.where}.${e.id} -> ${e.href}`);

    expect(broken, "these are live and clickable, and lead to a 404").toEqual(
      [],
    );
  });

  it("does not advertise Soon for something that already ships", () => {
    // The inverse, and the one that hides finished work. A module whose
    // page exists but whose status is not live renders a Soon chip and
    // drops its link, so the department looks unbuilt.
    const stale = allEntries()
      .filter((e) => e.status !== "live" && e.href && hasPage(e.href) === true)
      .map((e) => `${e.where}.${e.id} -> ${e.href} (status: ${e.status})`);

    expect(
      stale,
      "these have shipped but are still marked as coming soon",
    ).toEqual([]);
  });
});
