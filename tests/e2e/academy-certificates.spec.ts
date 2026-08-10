/**
 * Academy Certificates list + detail (Story #5).
 *
 * Sarah is seeded with 2 certificates (Emergency Procedures — Part
 * 135 + HAZMAT Recognition — Story #1 _seed_academy). This spec
 * verifies:
 *   1. /academy/certificates renders both under the "Mine" scope
 *      with the cert number + course title.
 *   2. The learner sees a scope toggle (chief_pilot / exec_admin
 *      role) — Sarah is a chief pilot so the toggle appears.
 *   3. Clicking a row navigates to the detail page which renders
 *      the "Certificate of Completion" card + a Print button.
 *
 * Deliberately no state mutation — the seed drives everything and
 * the certs are read-only.
 */

import { test as base, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SARAH_EMAIL = "sarah.kessler@peregrine.local";
const SARAH_PASSWORD = "flightops-dev";

const storageRoot = join(tmpdir(), "flightops-e2e-auth-sarah-certs");
mkdirSync(storageRoot, { recursive: true });

async function signInAsSarah(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(SARAH_EMAIL);
  await page.getByLabel(/password/i).fill(SARAH_PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL((url) => !/\/login/.test(url.pathname));
}

const test = base.extend<{ sarahPage: Page }>({
  sarahPage: async ({ browser }, use, testInfo) => {
    const storageFile = join(
      storageRoot,
      `worker-${testInfo.parallelIndex}.json`,
    );
    let context = await browser.newContext();
    let page = await context.newPage();
    try {
      await signInAsSarah(page);
      await context.storageState({ path: storageFile });
    } finally {
      await context.close();
    }
    context = await browser.newContext({ storageState: storageFile });
    page = await context.newPage();
    await use(page);
    await context.close();
  },
});

test.describe("Academy — Certificate list + detail", () => {
  test("Sarah's seeded certificates render on /academy/certificates", async ({
    sarahPage,
  }) => {
    await sarahPage.goto("/academy/certificates");

    // Sub-nav highlights Certificates.
    const navCert = sarahPage
      .getByRole("navigation", { name: /academy sections/i })
      .getByRole("link", { name: /^certificates$/i });
    await expect(navCert).toHaveAttribute("aria-current", "page");

    // Both seeded certs land — cert numbers use the ACAD-<short>-<year> shape.
    await expect(
      sarahPage.getByText(/Emergency Procedures — Part 135/),
    ).toBeVisible();
    await expect(
      sarahPage.getByText(/HAZMAT Recognition for Ramp & Load Team/),
    ).toBeVisible();
    await expect(sarahPage.getByText(/ACAD-/).first()).toBeVisible();
  });

  test("Chief-pilot Sarah sees the Mine / All scope toggle", async ({
    sarahPage,
  }) => {
    await sarahPage.goto("/academy/certificates");
    const scope = sarahPage.getByRole("navigation", {
      name: /certificate scope/i,
    });
    await expect(scope).toBeVisible();
    await expect(
      scope.getByRole("link", { name: /^mine$/i }),
    ).toBeVisible();
    await expect(
      scope.getByRole("link", { name: /all \(tenant\)/i }),
    ).toBeVisible();
  });

  test("Clicking a row loads the cert detail page with Print button", async ({
    sarahPage,
  }) => {
    await sarahPage.goto("/academy/certificates");
    await sarahPage
      .getByRole("link", { name: /Emergency Procedures — Part 135/ })
      .first()
      .click();

    // Scope subsequent assertions to the cert card so we don't
    // collide with the header banner's "Sarah Kessler" nameplate.
    const heading = sarahPage.getByRole("heading", {
      name: /certificate of completion/i,
    });
    await expect(heading).toBeVisible();
    const certCard = heading.locator("xpath=ancestor::article").first();
    await expect(certCard).toContainText("Sarah Kessler");
    await expect(certCard).toContainText("Emergency Procedures — Part 135");
    await expect(certCard).toContainText(/ACAD-/);
    await expect(
      sarahPage.getByRole("button", { name: /^print$/i }),
    ).toBeVisible();
    // View-progress link points back at the source enrollment so the
    // trail from cert → completion → lessons is traversable.
    await expect(
      sarahPage.getByRole("link", { name: /view progress →/i }),
    ).toBeVisible();
  });
});
