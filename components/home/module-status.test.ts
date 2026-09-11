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

/**
 * The two registries have to agree about the modules they share.
 *
 * HOME_MODULES is a department grid — sixteen tiles — and DEPARTMENTS is
 * the sidebar, ninety children. They are not mirrors, and most sidebar
 * entries rightly have no tile. But five ids appear in both, and when
 * those two copies disagree the home page tells a different story from
 * the sidebar. Invoicing shipped that way: `live` in the sidebar, `soon`
 * on home, so the tile rendered greyed out and unclickable while the
 * same module worked from the sidebar. It was reported as "Invoicing on
 * the home page is disabled, I can't access".
 *
 * WHAT THIS ADDS OVER THE CHECKS ABOVE — worth being exact about,
 * because the two overlap and it would be easy to claim more than is
 * true. The filesystem checks above would also have failed on that
 * Invoicing bug, and did: a `soon` entry whose page.tsx exists trips
 * "does not advertise Soon for something that already ships". They
 * catch most status drift, but only ever indirectly — via whether a
 * page happens to exist on disk.
 *
 * The href check is the one they genuinely cannot make. hasPage() strips
 * the slashes off a route before testing it, so /documents/ and
 * /documents both resolve to the same page.tsx and both pass. Two
 * registries naming one route two different ways is invisible to every
 * assertion above it. That is a live defect this found.
 *
 * The status check earns its place on the pairs the filesystem cannot
 * arbitrate — two non-live statuses that disagree with each other
 * (`m4` here, `soon` there) on a route with no page yet. Cheap, and it
 * states the invariant directly instead of inferring it from disk.
 */
describe("the home grid and the sidebar agree", () => {
  function sharedIds() {
    const sidebar = new Map<string, { status?: string; href?: string }>();
    for (const dept of DEPARTMENTS) {
      for (const child of dept.children) {
        sidebar.set(child.id, { status: child.status, href: child.href });
      }
    }
    return HOME_MODULES.filter((m) => sidebar.has(m.id)).map((m) => ({
      id: m.id,
      home: { status: m.status, href: m.href },
      side: sidebar.get(m.id)!,
    }));
  }

  it("finds shared ids to check", () => {
    // Guards the guard: if the ids ever stop overlapping, the assertions
    // below pass vacuously and this notices instead.
    expect(sharedIds().length).toBeGreaterThanOrEqual(5);
  });

  it("never shows a module as live in one place and coming soon in the other", () => {
    const disagree = sharedIds()
      .filter((e) => e.home.status !== e.side.status)
      .map((e) => `${e.id}: home=${e.home.status} sidebar=${e.side.status}`);

    expect(
      disagree,
      "the home tile and the sidebar entry disagree about whether this ships",
    ).toEqual([]);
  });

  it("points both copies at the same route", () => {
    // Trailing slashes count. /documents/ and /documents resolve to the
    // same page only because Next redirects; two registries naming one
    // route two ways is drift whether or not it currently costs a 404.
    const disagree = sharedIds()
      .filter((e) => e.home.href !== e.side.href)
      .map((e) => `${e.id}: home=${e.home.href} sidebar=${e.side.href}`);

    expect(disagree, "same module, two different hrefs").toEqual([]);
  });
});
