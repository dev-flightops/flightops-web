/**
 * Page-level a11y sweep — runs axe-core against every reachable page in the
 * app, with the same WCAG tag set the vitest helper uses (wcag2a + wcag2aa)
 * plus color-contrast (which only works in a real browser).
 *
 * Local/pre-merge: `npm run test:e2e -- a11y.spec.ts` while the dev server
 * and the backend stack are running. Not in CI yet — see ACCESSIBILITY.md.
 */

import AxeBuilder from "@axe-core/playwright";

import { test, expect } from "./fixtures/auth";

const PUBLIC_PAGES = ["/login"];

const AUTHENTICATED_PAGES = [
  "/",
  "/dispatch",
  "/dashboards",
  "/dashboards/executive",
  "/dashboards/dispatcher",
  "/dashboards/director-ops",
  "/dashboards/station",
  // Placeholders — still need to pass even though they show "coming soon".
  "/dashboards/chief-pilot",
  "/dashboards/ops-score",
  // M2-G-18 additions — flight-crew portal.
  "/flight-crew",
  "/flight-crew/elog",
  "/flight-crew/history",
  "/flight-crew/history?tab=duty",
  "/flight-crew/elog/cp-reviews",
  // Compliance surfaces — three views over the same data.
  "/compliance/crew-currency",
  "/compliance/crew-currency?view=list",
  "/compliance/crew-currency?view=calendar",
  // Maintenance surfaces.
  "/maintenance",
  "/maintenance/squawks",
  "/maintenance/mel",
  // Ground ops + fuel + ramper.
  "/ground-ops",
  "/fuel",
  "/fuel/orders",
  "/fuel/orders/new",
  "/fuel/quality",
  "/fuel/suppliers",
  "/ramper",
  "/ramp-ops",
  "/stations",
  // Ops-adjacent.
  "/schedule",
  "/weather",
  "/village-wx",
  "/flight-following",
  "/flight-following/history",
  "/eod",
  // Settings.
  "/settings",
  "/settings/users",
  "/settings/company",
  "/settings/bases",
  "/settings/permissions",
  "/settings/sso",
  "/settings/flight-tracking",
];

test.describe("a11y — public pages", () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path} has no WCAG A/AA violations`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
});

test.describe("a11y — authenticated pages", () => {
  for (const path of AUTHENTICATED_PAGES) {
    test(`${path} has no WCAG A/AA violations`, async ({ loggedInPage }) => {
      await loggedInPage.goto(path);
      const results = await new AxeBuilder({ page: loggedInPage })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
});

// Dispatch detail needs a real flight id, so pull one from the list first.
test.describe("a11y — dispatch detail", () => {
  test("/dispatch/[flightId] has no WCAG A/AA violations", async ({
    loggedInPage,
  }) => {
    await loggedInPage.goto("/dispatch");

    // Each FlightCard wraps a link to /dispatch/<uuid> — grab the first.
    const firstFlightLink = loggedInPage
      .locator('a[href^="/dispatch/"]')
      .first();
    const href = await firstFlightLink.getAttribute("href");
    test.skip(!href, "No flights seeded — run scripts/seed_demo.py");

    await loggedInPage.goto(href!);
    const results = await new AxeBuilder({ page: loggedInPage })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

// M2-G-18 — dynamic-id sweeps. Each pulls a real id from a listing
// page first so the assertion has real data to render against.

test.describe("a11y — compliance pilot profile", () => {
  test("/compliance/pilots/[pilotId] has no WCAG A/AA violations", async ({
    loggedInPage,
  }) => {
    await loggedInPage.goto("/compliance/crew-currency");
    const firstPilotLink = loggedInPage
      .locator('a[href^="/compliance/pilots/"]')
      .first();
    const href = await firstPilotLink.getAttribute("href");
    test.skip(!href, "No pilots on roster — seed the demo tenant");

    await loggedInPage.goto(href!);
    const results = await new AxeBuilder({ page: loggedInPage })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("a11y — maintenance aircraft detail", () => {
  test("/maintenance/aircraft/[id] has no WCAG A/AA violations", async ({
    loggedInPage,
  }) => {
    await loggedInPage.goto("/maintenance");
    const firstAircraftLink = loggedInPage
      .locator('a[href^="/maintenance/aircraft/"]')
      .first();
    const href = await firstAircraftLink.getAttribute("href");
    test.skip(!href, "No aircraft seeded");

    await loggedInPage.goto(href!);
    const results = await new AxeBuilder({ page: loggedInPage })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("a11y — preflight 8-step", () => {
  test("/flight-crew/preflight/[flightId] has no WCAG A/AA violations", async ({
    loggedInPage,
  }) => {
    // Pull a flight id from the schedule so the preflight page has a
    // real flight to render against. Preflight requires the flight
    // exist and the caller be on the tenant.
    await loggedInPage.goto("/schedule");
    const firstFlightLink = loggedInPage
      .locator('a[href*="/preflight/"]')
      .first();
    const href = await firstFlightLink.getAttribute("href").catch(() => null);
    // Fallback: try the /dispatch listing.
    if (!href) {
      await loggedInPage.goto("/dispatch");
      const alt = loggedInPage
        .locator('a[href^="/dispatch/"]')
        .first();
      const dispatchHref = await alt.getAttribute("href");
      test.skip(!dispatchHref, "No scheduled flights — seed the demo tenant");
      const flightId = dispatchHref!.split("/").pop();
      await loggedInPage.goto(`/flight-crew/preflight/${flightId}`);
    } else {
      await loggedInPage.goto(href);
    }
    const results = await new AxeBuilder({ page: loggedInPage })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("a11y — flight log detail", () => {
  test("/flight-crew/elog/[id] has no WCAG A/AA violations", async ({
    loggedInPage,
  }) => {
    await loggedInPage.goto("/flight-crew/elog");
    const firstLogLink = loggedInPage
      .locator('a[href*="/flight-crew/elog/"]')
      .filter({ hasNot: loggedInPage.locator('a[href*="cp-reviews"]') })
      .first();
    const href = await firstLogLink.getAttribute("href").catch(() => null);
    test.skip(!href, "No flight logs seeded — submit one first");

    await loggedInPage.goto(href!);
    const results = await new AxeBuilder({ page: loggedInPage })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
