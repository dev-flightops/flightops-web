import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DEPARTMENTS } from "@/components/app-shell/modules";
import { MAINTENANCE_ACTIONS } from "@/components/maintenance/maintenance-header";
import { GROUND_OPS_LINKS } from "@/app/(app)/ground-ops/links";

import { HOME_MODULES } from "./module-catalog";
import { HOME_QUICK_LINKS } from "./quick-links";

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
 * WHAT THIS SWEEPS, AND WHY IT GREW
 *
 * It started on HOME_MODULES and DEPARTMENTS, and both checks below
 * would have caught the home page's Business Intelligence shortcut —
 * marked `m4` after BI shipped, AND pointing at /reports/executive/bi,
 * a route that never existed. It was outside the sweep, so it was
 * outside the guard.
 *
 * Same for the maintenance header, where five shipped pages stayed
 * dimmed: Work Orders, Inventory, RTS Queue, the due list and
 * + Aircraft. The department nav linked them; the header a mechanic
 * actually reaches for did not.
 *
 * And the Ground Ops hub, which dimmed Add Station and later Add
 * Equipment the same way while both forms worked. Its links lived
 * inside the page file, where this test could not import them.
 *
 * So the rule is now: a catalogue of (href, status) pairs anywhere in
 * this app belongs in `allEntries()`. Adding one here is cheaper than
 * finding out from a screenshot.
 *
 * WHAT THIS CANNOT SEE
 *
 * Routes with dynamic segments, and any page that renders but then
 * notFound()s on its own. The existence of page.tsx is the floor, not
 * proof the page is useful.
 *
 * Also invisible: disabled buttons with no href at all — the top bar's
 * Notifications, Owner Admin and Help, and the dispatch packet's AI
 * buttons. Nothing links them to a route, so nothing here can tell
 * whether their feature exists. Those need reading, which is how the
 * top bar's Users button was found still disabled over a live page.
 *
 * That blind spot had already cost something. The maintenance header's
 * "+ Aircraft" stayed dimmed as `m3`, annotated "an add form we never
 * built", while /settings/fleet had been calling createAircraftAction
 * through AddAircraftDialog since M2. Four of the five dimmed entries in
 * that catalogue were caught here; that one was not, purely because it
 * carried no href for hasPage() to test. Being unreachable by the guard
 * is what let it stay wrong.
 *
 * So a non-live entry now has to carry an href, which is what puts it
 * inside the sweep. NON_LIVE_WITHOUT_HREF is for the genuine cases —
 * something with no route to point at yet — and naming a reason there is
 * the price of leaving the guard's reach.
 */

const APP_DIR = "app/(app)";

/**
 * Non-live catalogue entries with nothing to point at yet.
 * `where.id` -> why there is no route.
 */
const NON_LIVE_WITHOUT_HREF: Record<string, string> = {
  "MAINTENANCE_ACTIONS.Inspections": "No inspections module in any milestone yet.",
  "MAINTENANCE_ACTIONS.Vendors": "No vendors module in any milestone yet.",
  "MAINTENANCE_ACTIONS.Roster": "Mechanic roster is unscheduled.",

  // Legacy puts Crew inside the Operations nav (`/crew/`, base.html
  // line 407), not in a department of its own. We never built it.
  "DEPARTMENTS.operations.crew": "Legacy /crew/ under Operations; not built.",

  // The Crew department is unreachable dead config, not a dimmed
  // feature. Its pathPrefixes are ["/crew-admin"], and no /crew-admin
  // page exists, so nothing can put a user inside the department —
  // department-nav only ever renders the current department's children,
  // and the help panel skips children with no href. Every feature it
  // names already ships somewhere a user can actually get to, which is
  // why nobody noticed: Roster at /compliance/roster, Duty & Rest at
  // /time-clock, Training in the Academy department, Payroll at
  // /payroll — the last two duplicating HR's own live children.
  // Removing the department is cleanup for Greg to call, not a fix to
  // smuggle in here; wiring the four to those routes would put Payroll
  // and Time Clock in the sidebar twice and hand /academy's own
  // pathPrefix to a second department.
  "DEPARTMENTS.crew.crew-roster": "Unreachable dept; ships at /compliance/roster.",
  "DEPARTMENTS.crew.duty-rest": "Unreachable dept; ships at /time-clock.",
  "DEPARTMENTS.crew.training": "Unreachable dept; ships as the Academy department.",
  "DEPARTMENTS.crew.crew-payroll": "Unreachable dept; ships at /payroll (also HR's).",
};

/** Does a concrete (non-dynamic) route have a page?
 *
 *  A query string or hash is not part of the path — the quick links use
 *  `/flight-crew/history?tab=duty`, and treating that whole string as a
 *  directory reported a live page as a 404. */
function hasPage(href: string): boolean | null {
  const path = href.split(/[?#]/)[0];
  if (!path.startsWith("/") || path.startsWith("/api") || path.includes("[")) {
    return null; // not statically checkable
  }
  const segments = path.replace(/^\/+|\/+$/g, "");
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
  for (const link of HOME_QUICK_LINKS) {
    out.push({
      where: "HOME_QUICK_LINKS",
      id: link.label,
      href: link.href,
      status: link.status,
    });
  }
  for (const action of MAINTENANCE_ACTIONS) {
    out.push({
      where: "MAINTENANCE_ACTIONS",
      id: action.label,
      href: action.href,
      status: action.status,
    });
  }
  for (const [id, link] of Object.entries(GROUND_OPS_LINKS)) {
    out.push({
      where: "GROUND_OPS_LINKS",
      id,
      href: link.href,
      status: link.status,
    });
  }
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

  it("gives every unbuilt entry a route, so it stays inside this sweep", () => {
    const unreachable = allEntries()
      .filter((e) => e.status !== undefined && e.status !== "live" && !e.href)
      .filter((e) => !(`${e.where}.${e.id}` in NON_LIVE_WITHOUT_HREF))
      .map((e) => `${e.where}.${e.id} (status: ${e.status})`);

    expect(
      unreachable,
      "no href means no check — declare these in NON_LIVE_WITHOUT_HREF with a reason",
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

/**
 * A department cannot be unbuilt while everything in it ships.
 *
 * The AI department carried `status: "m4"` over seven live children —
 * FleetBrain, Ops Brief, AI Query, Safety Intelligence, Delay Alerts,
 * MX Intelligence and Dispatch Intelligence — so the home grid
 * advertised the whole group as coming soon while every page inside it
 * worked.
 *
 * None of the checks above could see it. They test an entry's status
 * against whether its href has a page on disk, and a department has
 * no href — so a stale parent is invisible to every one of them. This
 * looks at the children instead.
 */
describe("a department's status matches what is inside it", () => {
  it("finds departments with children to check", () => {
    // Guards the guard.
    const withChildren = DEPARTMENTS.filter((d) => d.children.length > 0);
    expect(withChildren.length).toBeGreaterThanOrEqual(5);
  });

  it("never marks a department unbuilt when every child is live", () => {
    const stale = DEPARTMENTS.filter(
      (d) =>
        d.status !== "live" &&
        d.children.length > 0 &&
        d.children.every((c) => c.status === "live"),
    ).map((d) => `${d.id} (status: ${d.status}, ${d.children.length} live children)`);

    expect(
      stale,
      "these departments are marked coming soon over a full set of shipped pages",
    ).toEqual([]);
  });
});
