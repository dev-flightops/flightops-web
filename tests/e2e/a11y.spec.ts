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
