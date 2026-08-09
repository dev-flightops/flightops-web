/**
 * Documents required-reading + ack flow (Story #2 — Doc-Ack UI).
 *
 * Verifies the three surfaces that ship together:
 *   1. /documents landing — "Required reading" pill links to /documents/ack.
 *      Shown with a numeric badge only when the caller has pending acks.
 *   2. /documents/ack — required-reading queue, split into Pending and
 *      Acknowledged sections.
 *   3. /documents/[id] — AckPanel renders green when the caller has
 *      already acked the current version.
 *
 * Runs against a fresh docker stack with the demo seed loaded — Sarah
 * Kessler is seeded with an ack against the Safety Bulletin so the
 * green-panel path is repeatable across runs. The pending → button →
 * acked click path is validated manually via Chrome MCP (see
 * verify-demo skill); wiring click-through into the spec would leak
 * a new ack row on every run without a delete-ack endpoint to
 * clean up after.
 */

import { test as base, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SARAH_EMAIL = "sarah.kessler@peregrine.local";
const SARAH_PASSWORD = "flightops-dev";
const SAFETY_BULLETIN_TITLE = "Safety Bulletin 2026-08 — Icing on the Y-K Delta";

const storageRoot = join(tmpdir(), "flightops-e2e-auth-sarah");
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

test.describe("Documents — required reading + ack panel", () => {
  test("Required-reading queue shows Sarah's seeded ack under Acknowledged", async ({
    sarahPage,
  }) => {
    await sarahPage.goto("/documents/ack");

    // Header reflects the feed count. Sarah is seeded with one ack
    // and no pending items in a fresh seed.
    await expect(
      sarahPage.getByRole("heading", { name: /required reading/i }),
    ).toBeVisible();

    // Acknowledged section has the Safety Bulletin row.
    const ackedSection = sarahPage.locator("section", {
      has: sarahPage.getByRole("heading", { name: /acknowledged/i }),
    });
    await expect(ackedSection).toBeVisible();
    await expect(
      ackedSection.getByRole("link", { name: new RegExp(SAFETY_BULLETIN_TITLE) }),
    ).toBeVisible();
  });

  test("Landing page surfaces the Required reading link", async ({
    sarahPage,
  }) => {
    await sarahPage.goto("/documents");
    // Pill links to /documents/ack; it's present whenever the tenant
    // has any required-reading document at all (Sarah's seed does).
    const pill = sarahPage.locator('a[href="/documents/ack"]', {
      hasText: /required reading/i,
    });
    await expect(pill).toBeVisible();
  });

  test("Doc detail renders the green ack panel for an already-acked doc", async ({
    sarahPage,
  }) => {
    await sarahPage.goto("/documents/ack");
    const link = sarahPage.getByRole("link", {
      name: new RegExp(SAFETY_BULLETIN_TITLE),
    });
    await link.first().click();

    // AckPanel status region confirms the ack for the current version.
    const statusRegion = sarahPage.getByRole("status");
    await expect(statusRegion).toContainText(/you acknowledged this document/i);
    await expect(statusRegion).toContainText(/v1/);

    // No "I've read this" button when already acked.
    await expect(
      sarahPage.getByRole("button", { name: /i've read this/i }),
    ).toHaveCount(0);
  });
});
