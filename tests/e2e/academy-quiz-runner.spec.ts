/**
 * Academy Quiz Runner (Story #4b).
 *
 * Verifies the lesson-player quiz gate against the seeded state:
 * Sarah has a passing attempt on the Alaska-Specific Forced Landing
 * lesson of Emergency Procedures — Part 135, so the lesson-player
 * shows either "✓ Quiz passed" (if her enrollment hasn't been
 * marked complete on that lesson) or "✓ Completed" (if it has).
 *
 * The full submit → pass → mark-complete round-trip is validated
 * manually via Chrome MCP with a fresh pilot (Bob) — wiring the
 * submit into a spec would leak a completed enrollment + cert per
 * run without a delete-attempt endpoint to clean up.
 */

import { test as base, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SARAH_EMAIL = "sarah.kessler@peregrine.local";
const SARAH_PASSWORD = "flightops-dev";
const EMERGENCY_COURSE_TITLE = "Emergency Procedures — Part 135";
const QUIZ_LESSON_TITLE = "Alaska-Specific Forced Landing";

const storageRoot = join(tmpdir(), "flightops-e2e-auth-sarah-quiz");
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

test.describe("Academy — Quiz Runner + lesson gate", () => {
  test("Gated lesson shows passed indicator once the seeded attempt is on file", async ({
    sarahPage,
  }) => {
    await sarahPage.goto("/academy/mine");
    const enrolLink = sarahPage
      .getByRole("link", { name: new RegExp(EMERGENCY_COURSE_TITLE) })
      .first();
    await enrolLink.click();
    await sarahPage.waitForURL(/\/academy\/enrollments\//);

    await sarahPage
      .getByRole("link", { name: new RegExp(QUIZ_LESSON_TITLE) })
      .first()
      .click();

    // Either indicator is a valid seed outcome — post-attempt (not
    // yet marked complete) OR post-complete-lesson (Sarah's Story #1
    // seed already fires that on this enrollment via lesson-
    // completion writes). Both satisfy the story acceptance.
    const passedIndicator = sarahPage.getByText(/quiz passed/i);
    const doneIndicator = sarahPage.getByText(/completed/i).first();
    await expect(passedIndicator.or(doneIndicator)).toBeVisible();
  });
});
