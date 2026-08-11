/**
 * /settings/billing reader (Story #6, Slice 1).
 *
 * Backend gates all /billing/* endpoints on Role.EXEC_ADMIN, so
 * this spec runs two personas:
 *   - admin@flightops.local (exec_admin) — sees the full page with
 *     the seeded Growth subscription, 3 paid invoices, and the
 *     three-plan catalog with "Current" pill on Growth.
 *   - sarah.kessler@peregrine.local (chief_pilot) — hits the same
 *     URL and gets the "Admin access required" empty state,
 *     confirming the 403 fallback translates instead of surfacing
 *     the raw HTTP error.
 */

import { test as base, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ADMIN_EMAIL = "admin@flightops.local";
const SARAH_EMAIL = "sarah.kessler@peregrine.local";
const PASSWORD = "flightops-dev";

const storageRoot = join(tmpdir(), "flightops-e2e-auth-billing");
mkdirSync(storageRoot, { recursive: true });

async function signInAs(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL((url) => !/\/login/.test(url.pathname));
}

function loggedInAs(email: string, slug: string) {
  return async ({ browser }: { browser: import("@playwright/test").Browser }, use: (p: Page) => Promise<void>, testInfo: import("@playwright/test").TestInfo) => {
    const storageFile = join(
      storageRoot,
      `${slug}-worker-${testInfo.parallelIndex}.json`,
    );
    let context = await browser.newContext();
    let page = await context.newPage();
    try {
      await signInAs(page, email);
      await context.storageState({ path: storageFile });
    } finally {
      await context.close();
    }
    context = await browser.newContext({ storageState: storageFile });
    page = await context.newPage();
    await use(page);
    await context.close();
  };
}

const test = base.extend<{ adminPage: Page; sarahPage: Page }>({
  adminPage: loggedInAs(ADMIN_EMAIL, "admin"),
  sarahPage: loggedInAs(SARAH_EMAIL, "sarah"),
});

test.describe("Settings / Billing reader", () => {
  test("Admin sees current subscription, invoice history, and plan catalog", async ({
    adminPage,
  }) => {
    await adminPage.goto("/settings/billing");

    await expect(
      adminPage.getByRole("heading", { name: /billing & subscription/i }),
    ).toBeVisible();

    // Current subscription card — seeded as Growth · 5 seats.
    await expect(
      adminPage.getByRole("heading", { name: /^growth$/i, level: 2 }),
    ).toBeVisible();
    await expect(adminPage.getByText(/5 of 25 seats/)).toBeVisible();
    // Amount comes out as $1,495.00 (Growth 299 × 5 seats).
    await expect(adminPage.getByText(/\$1,495\.00/).first()).toBeVisible();

    // Invoice history — 3 seeded invoices.
    await expect(
      adminPage.getByRole("heading", { name: /last 3 invoices/i }),
    ).toBeVisible();
    await expect(adminPage.getByText(/PGR-2026-0101/)).toBeVisible();

    // Plan catalog + Current pill on Growth.
    await expect(
      adminPage.getByRole("heading", { name: /available tiers/i }),
    ).toBeVisible();
    await expect(
      adminPage.getByText(/^current$/i).first(),
    ).toBeVisible();
  });

  test("Chief-pilot Sarah gets the admin-only empty state instead of raw HTTP error", async ({
    sarahPage,
  }) => {
    await sarahPage.goto("/settings/billing");
    await expect(
      sarahPage.getByRole("heading", { name: /admin access required/i }),
    ).toBeVisible();
    // Regression guard: don't leak the raw HTTP 403.
    await expect(
      sarahPage.getByText(/HTTP\s*403|Forbidden/i),
    ).toHaveCount(0);
  });
});
